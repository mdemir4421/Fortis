from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import os
import uuid
from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio
import hashlib
import jwt
import requests
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Residence Site Management API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = "residence_site"
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Security
security = HTTPBearer()
SECRET_KEY = "your-secret-key-change-in-production"

# WAHA WhatsApp Integration
WAHA_BASE_URL = "http://fatihgezer.tr:3100"

# Pydantic Models
class UserLogin(BaseModel):
    username: str
    password: str
    language: Optional[str] = "tr"

class UserResponse(BaseModel):
    id: str
    username: str
    role: str
    apartment_number: Optional[str] = None
    unit_type: str  # apartment or shop
    language: str = "tr"

class DebtCreate(BaseModel):
    apartment_id: str
    amount: float
    description: str
    due_date: datetime
    debt_type: str = "monthly_fee"  # monthly_fee, maintenance, heating, other

class DebtResponse(BaseModel):
    id: str
    apartment_id: str
    amount: float
    description: str
    due_date: datetime
    debt_type: str
    created_date: datetime
    is_paid: bool = False
    paid_date: Optional[datetime] = None

class PaymentCreate(BaseModel):
    apartment_id: str
    debt_id: str
    amount: float
    payment_method: str = "bank_transfer"
    notes: Optional[str] = None

class AnnouncementCreate(BaseModel):
    title: str
    content: str
    is_urgent: bool = False

class VehicleInfo(BaseModel):
    vehicle_type: str  # car or motorcycle
    has_vehicle: bool = False
    plate_number: Optional[str] = None
    model: Optional[str] = None

class HouseholdUpdate(BaseModel):
    occupant_count: int
    contact_phone: Optional[str] = None
    vehicles: Optional[List[VehicleInfo]] = []

class WhatsAppMessage(BaseModel):
    apartment_id: str
    message: str

# Utility Functions
def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_jwt_token(data: dict):
    return jwt.encode(data, SECRET_KEY, algorithm="HS256")

def decode_jwt_token(token: str):
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_jwt_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return payload

async def send_whatsapp_message(phone_number: str, message: str) -> bool:
    """Send WhatsApp message via WAHA API"""
    try:
        # Format phone number for WhatsApp (Turkish format)
        if phone_number.startswith("0"):
            phone_number = "90" + phone_number[1:]  # Convert 05XX to 905XX
        elif not phone_number.startswith("90"):
            phone_number = "90" + phone_number
        
        chat_id = f"{phone_number}@c.us"
        
        payload = {
            "chatId": chat_id,
            "text": message
        }
        
        response = requests.post(f"{WAHA_BASE_URL}/sendText", json=payload, timeout=30)
        return response.status_code == 200
    except Exception as e:
        print(f"WhatsApp send error: {e}")
        return False

# Initialize database collections and default data
async def init_database():
    """Initialize database with apartments and default admin"""
    
    # Create apartments (apartment01 to apartment62)
    apartments_collection = db.apartments
    users_collection = db.users
    
    # Check if apartments already exist
    existing_count = await apartments_collection.count_documents({})
    if existing_count == 0:
        apartments = []
        users = []
        
        # Create apartments
        for i in range(1, 63):
            apartment_num = f"apartment{i:02d}"
            apartment_id = str(uuid.uuid4())
            
            apartment = {
                "_id": apartment_id,
                "apartment_number": apartment_num,
                "unit_type": "apartment",
                "occupant_count": 1,
                "contact_phone": "",
                "vehicles": [],
                "created_date": datetime.utcnow()
            }
            apartments.append(apartment)
            
            # Create user for this apartment
            user = {
                "_id": str(uuid.uuid4()),
                "username": apartment_num,
                "password": hash_password(apartment_num),  # Default password same as username
                "role": "resident",
                "apartment_id": apartment_id,
                "apartment_number": apartment_num,
                "unit_type": "apartment",
                "language": "tr",
                "must_change_password": True,
                "created_date": datetime.utcnow()
            }
            users.append(user)
        
        # Create shops
        for i in range(1, 3):
            shop_num = f"shop{i:02d}"
            shop_id = str(uuid.uuid4())
            
            shop = {
                "_id": shop_id,
                "apartment_number": shop_num,
                "unit_type": "shop",
                "occupant_count": 1,
                "contact_phone": "",
                "vehicles": [],
                "created_date": datetime.utcnow()
            }
            apartments.append(shop)
            
            # Create user for this shop
            user = {
                "_id": str(uuid.uuid4()),
                "username": shop_num,
                "password": hash_password(shop_num),
                "role": "resident",
                "apartment_id": shop_id,
                "apartment_number": shop_num,
                "unit_type": "shop",
                "language": "tr",
                "must_change_password": True,
                "created_date": datetime.utcnow()
            }
            users.append(user)
        
        # Insert all apartments and users
        await apartments_collection.insert_many(apartments)
        await users_collection.insert_many(users)
        
        # Create admin user
        admin_user = {
            "_id": str(uuid.uuid4()),
            "username": "admin",
            "password": hash_password("admin123"),  # Change this in production
            "role": "admin",
            "apartment_id": None,
            "apartment_number": None,
            "unit_type": "admin",
            "language": "tr",
            "must_change_password": False,
            "created_date": datetime.utcnow()
        }
        await users_collection.insert_one(admin_user)
        
        print("Database initialized with 62 apartments, 2 shops, and admin user")

# API Endpoints

@app.on_event("startup")
async def startup_event():
    await init_database()

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "database": DB_NAME}

@app.post("/api/auth/login")
async def login(user_data: UserLogin):
    """Login for both residents and admin"""
    users_collection = db.users
    
    user = await users_collection.find_one({"username": user_data.username})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Update user language preference
    await users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"language": user_data.language}}
    )
    
    token_data = {
        "user_id": user["_id"],
        "username": user["username"],
        "role": user["role"],
        "apartment_id": user.get("apartment_id"),
        "exp": datetime.utcnow() + timedelta(hours=24)
    }
    
    token = create_jwt_token(token_data)
    
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["_id"],
            "username": user["username"],
            "role": user["role"],
            "apartment_number": user.get("apartment_number"),
            "unit_type": user.get("unit_type"),
            "language": user_data.language,
            "must_change_password": user.get("must_change_password", False)
        }
    }

@app.get("/api/apartments")
async def get_apartments(current_user: dict = Depends(get_current_user)):
    """Get all apartments (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    apartments = []
    async for apartment in db.apartments.find():
        apartments.append({
            "id": apartment["_id"],
            "apartment_number": apartment["apartment_number"],
            "unit_type": apartment["unit_type"],
            "occupant_count": apartment["occupant_count"],
            "contact_phone": apartment["contact_phone"],
            "vehicles": apartment["vehicles"]
        })
    
    return apartments

@app.post("/api/debts")
async def create_debt(debt: DebtCreate, current_user: dict = Depends(get_current_user)):
    """Create new debt (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    debt_doc = {
        "_id": str(uuid.uuid4()),
        "apartment_id": debt.apartment_id,
        "amount": debt.amount,
        "description": debt.description,
        "due_date": debt.due_date,
        "debt_type": debt.debt_type,
        "created_date": datetime.utcnow(),
        "is_paid": False,
        "paid_date": None
    }
    
    await db.debts.insert_one(debt_doc)
    return {"message": "Debt created successfully", "debt_id": debt_doc["_id"]}

@app.get("/api/debts")
async def get_debts(apartment_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Get debts - admin sees all, residents see only their own"""
    
    query = {}
    if current_user["role"] == "resident":
        query["apartment_id"] = current_user["apartment_id"]
    elif apartment_id:
        query["apartment_id"] = apartment_id
    
    debts = []
    async for debt in db.debts.find(query).sort("due_date", -1):
        # Get apartment info
        apartment = await db.apartments.find_one({"_id": debt["apartment_id"]})
        
        debts.append({
            "id": debt["_id"],
            "apartment_id": debt["apartment_id"],
            "apartment_number": apartment["apartment_number"] if apartment else "Unknown",
            "amount": debt["amount"],
            "description": debt["description"],
            "due_date": debt["due_date"],
            "debt_type": debt["debt_type"],
            "created_date": debt["created_date"],
            "is_paid": debt["is_paid"],
            "paid_date": debt.get("paid_date")
        })
    
    return debts

@app.post("/api/debts/{debt_id}/pay")
async def mark_debt_paid(debt_id: str, current_user: dict = Depends(get_current_user)):
    """Mark debt as paid (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.debts.update_one(
        {"_id": debt_id},
        {"$set": {"is_paid": True, "paid_date": datetime.utcnow()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Debt not found")
    
    return {"message": "Debt marked as paid"}

@app.post("/api/announcements")
async def create_announcement(announcement: AnnouncementCreate, current_user: dict = Depends(get_current_user)):
    """Create announcement (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    announcement_doc = {
        "_id": str(uuid.uuid4()),
        "title": announcement.title,
        "content": announcement.content,
        "is_urgent": announcement.is_urgent,
        "created_date": datetime.utcnow(),
        "created_by": current_user["user_id"]
    }
    
    await db.announcements.insert_one(announcement_doc)
    return {"message": "Announcement created successfully"}

@app.get("/api/announcements")
async def get_announcements(current_user: dict = Depends(get_current_user)):
    """Get all announcements"""
    announcements = []
    async for announcement in db.announcements.find().sort("created_date", -1).limit(20):
        announcements.append({
            "id": announcement["_id"],
            "title": announcement["title"],
            "content": announcement["content"],
            "is_urgent": announcement["is_urgent"],
            "created_date": announcement["created_date"]
        })
    
    return announcements

@app.post("/api/whatsapp/send-debt-reminders")
async def send_debt_reminders(current_user: dict = Depends(get_current_user)):
    """Send WhatsApp debt reminders to all residents with unpaid debts (admin only)"""
    if current_user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Find all unpaid debts
    unpaid_debts = []
    async for debt in db.debts.find({"is_paid": False}):
        unpaid_debts.append(debt)
    
    # Group debts by apartment
    debts_by_apartment = {}
    for debt in unpaid_debts:
        apartment_id = debt["apartment_id"]
        if apartment_id not in debts_by_apartment:
            debts_by_apartment[apartment_id] = []
        debts_by_apartment[apartment_id].append(debt)
    
    sent_count = 0
    failed_count = 0
    
    for apartment_id, debts in debts_by_apartment.items():
        # Get apartment info
        apartment = await db.apartments.find_one({"_id": apartment_id})
        if not apartment or not apartment.get("contact_phone"):
            failed_count += 1
            continue
        
        # Calculate total debt
        total_debt = sum(debt["amount"] for debt in debts)
        
        # Create message
        message = f"""Sayın {apartment['apartment_number']} Sakini,

Aidat borcunuz bulunmaktadır:
Toplam Borç: {total_debt:.2f} TL

Borç Detayları:"""
        
        for debt in debts:
            due_date = debt["due_date"].strftime("%d.%m.%Y")
            message += f"\n• {debt['description']}: {debt['amount']:.2f} TL (Vade: {due_date})"
        
        message += "\n\nLütfen en kısa sürede ödemenizi yapınız.\nTeşekkürler."
        
        # Send WhatsApp message
        success = await send_whatsapp_message(apartment["contact_phone"], message)
        if success:
            sent_count += 1
        else:
            failed_count += 1
    
    return {
        "message": f"Debt reminders sent",
        "sent_count": sent_count,
        "failed_count": failed_count,
        "total_apartments_with_debt": len(debts_by_apartment)
    }

@app.put("/api/apartments/{apartment_id}/household")
async def update_household_info(apartment_id: str, household: HouseholdUpdate, current_user: dict = Depends(get_current_user)):
    """Update household information"""
    # Residents can only update their own apartment, admins can update any
    if current_user["role"] == "resident" and current_user["apartment_id"] != apartment_id:
        raise HTTPException(status_code=403, detail="Can only update your own apartment")
    
    update_data = {
        "occupant_count": household.occupant_count,
        "contact_phone": household.contact_phone,
        "vehicles": [vehicle.dict() for vehicle in household.vehicles] if household.vehicles else []
    }
    
    result = await db.apartments.update_one(
        {"_id": apartment_id},
        {"$set": update_data}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Apartment not found")
    
    return {"message": "Household information updated successfully"}

@app.get("/api/apartments/{apartment_id}")
async def get_apartment_details(apartment_id: str, current_user: dict = Depends(get_current_user)):
    """Get apartment details"""
    # Residents can only view their own apartment, admins can view any
    if current_user["role"] == "resident" and current_user["apartment_id"] != apartment_id:
        raise HTTPException(status_code=403, detail="Can only view your own apartment")
    
    apartment = await db.apartments.find_one({"_id": apartment_id})
    if not apartment:
        raise HTTPException(status_code=404, detail="Apartment not found")
    
    return {
        "id": apartment["_id"],
        "apartment_number": apartment["apartment_number"],
        "unit_type": apartment["unit_type"],
        "occupant_count": apartment["occupant_count"],
        "contact_phone": apartment["contact_phone"],
        "vehicles": apartment["vehicles"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)