import requests
import json
from datetime import datetime, timedelta
import sys
import time

class ResidenceSiteAPITester:
    def __init__(self, base_url):
        self.base_url = base_url
        self.admin_token = None
        self.resident_token = None
        self.admin_headers = None
        self.resident_headers = None
        self.tests_run = 0
        self.tests_passed = 0
        self.created_debt_id = None
        self.apartment_id = None
        
    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    print(f"Response: {response.json()}")
                except:
                    print(f"Response: {response.text}")
                return False, {}
                
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}
    
    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"username": "admin", "password": "admin123", "language": "en"}
        )
        
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.admin_headers = {'Authorization': f'Bearer {self.admin_token}'}
            print(f"Admin user details: {response['user']}")
            return True
        return False
    
    def test_resident_login(self):
        """Test resident login"""
        success, response = self.run_test(
            "Resident Login",
            "POST",
            "api/auth/login",
            200,
            data={"username": "apartment01", "password": "apartment01", "language": "en"}
        )
        
        if success and 'access_token' in response:
            self.resident_token = response['access_token']
            self.resident_headers = {'Authorization': f'Bearer {self.resident_token}'}
            print(f"Resident user details: {response['user']}")
            if response['user'].get('apartment_id'):
                self.apartment_id = response['user']['apartment_id']
            return True
        return False
    
    def test_get_apartments_admin(self):
        """Test getting apartments as admin"""
        if not self.admin_headers:
            print("❌ Admin not logged in, skipping test")
            return False
            
        success, response = self.run_test(
            "Get Apartments (Admin)",
            "GET",
            "api/apartments",
            200,
            headers=self.admin_headers
        )
        
        if success and isinstance(response, list):
            print(f"Found {len(response)} apartments")
            if len(response) > 0:
                print(f"First apartment: {response[0]['apartment_number']}")
                # If we don't have an apartment ID yet, use the first one
                if not self.apartment_id:
                    self.apartment_id = response[0]['id']
            return True
        return False
    
    def test_get_apartments_resident(self):
        """Test getting apartments as resident (should be forbidden)"""
        if not self.resident_headers:
            print("❌ Resident not logged in, skipping test")
            return False
            
        success, _ = self.run_test(
            "Get Apartments (Resident - Should Fail)",
            "GET",
            "api/apartments",
            403,
            headers=self.resident_headers
        )
        
        return success
    
    def test_create_debt(self):
        """Test creating a debt as admin"""
        if not self.admin_headers or not self.apartment_id:
            print("❌ Admin not logged in or no apartment ID, skipping test")
            return False
            
        due_date = (datetime.now() + timedelta(days=30)).isoformat()
        
        success, response = self.run_test(
            "Create Debt",
            "POST",
            "api/debts",
            200,
            headers=self.admin_headers,
            data={
                "apartment_id": self.apartment_id,
                "amount": 150.0,
                "description": "Monthly Fee - June 2025",
                "due_date": due_date,
                "debt_type": "monthly_fee"
            }
        )
        
        if success and 'debt_id' in response:
            self.created_debt_id = response['debt_id']
            print(f"Created debt with ID: {self.created_debt_id}")
            return True
        return False
    
    def test_get_debts_admin(self):
        """Test getting all debts as admin"""
        if not self.admin_headers:
            print("❌ Admin not logged in, skipping test")
            return False
            
        success, response = self.run_test(
            "Get Debts (Admin)",
            "GET",
            "api/debts",
            200,
            headers=self.admin_headers
        )
        
        if success and isinstance(response, list):
            print(f"Found {len(response)} debts")
            if len(response) > 0:
                print(f"First debt: {response[0]['description']} - {response[0]['amount']} - Paid: {response[0]['is_paid']}")
                # If we don't have a debt ID yet, use the first one
                if not self.created_debt_id:
                    self.created_debt_id = response[0]['id']
            return True
        return False
    
    def test_get_debts_resident(self):
        """Test getting debts as resident (should only see their own)"""
        if not self.resident_headers:
            print("❌ Resident not logged in, skipping test")
            return False
            
        success, response = self.run_test(
            "Get Debts (Resident)",
            "GET",
            "api/debts",
            200,
            headers=self.resident_headers
        )
        
        if success and isinstance(response, list):
            print(f"Resident can see {len(response)} debts")
            return True
        return False
    
    def test_pay_debt(self):
        """Test marking a debt as paid (admin only)"""
        if not self.admin_headers or not self.created_debt_id:
            print("❌ Admin not logged in or no debt ID, skipping test")
            return False
            
        success, response = self.run_test(
            "Mark Debt as Paid",
            "POST",
            f"api/debts/{self.created_debt_id}/pay",
            200,
            headers=self.admin_headers
        )
        
        return success
    
    def test_pay_debt_resident(self):
        """Test marking a debt as paid as resident (should fail)"""
        if not self.resident_headers or not self.created_debt_id:
            print("❌ Resident not logged in or no debt ID, skipping test")
            return False
            
        success, _ = self.run_test(
            "Mark Debt as Paid (Resident - Should Fail)",
            "POST",
            f"api/debts/{self.created_debt_id}/pay",
            403,
            headers=self.resident_headers
        )
        
        return success
    
    def test_create_announcement(self):
        """Test creating an announcement as admin"""
        if not self.admin_headers:
            print("❌ Admin not logged in, skipping test")
            return False
            
        success, response = self.run_test(
            "Create Announcement",
            "POST",
            "api/announcements",
            200,
            headers=self.admin_headers,
            data={
                "title": "Test Announcement",
                "content": "This is a test announcement created by the API tester.",
                "is_urgent": True
            }
        )
        
        return success
    
    def test_create_announcement_resident(self):
        """Test creating an announcement as resident (should fail)"""
        if not self.resident_headers:
            print("❌ Resident not logged in, skipping test")
            return False
            
        success, _ = self.run_test(
            "Create Announcement (Resident - Should Fail)",
            "POST",
            "api/announcements",
            403,
            headers=self.resident_headers,
            data={
                "title": "Test Announcement",
                "content": "This is a test announcement created by a resident.",
                "is_urgent": False
            }
        )
        
        return success
    
    def test_get_announcements(self):
        """Test getting announcements (both admin and resident)"""
        if not self.admin_headers:
            print("❌ Admin not logged in, skipping test")
            return False
            
        success_admin, response_admin = self.run_test(
            "Get Announcements (Admin)",
            "GET",
            "api/announcements",
            200,
            headers=self.admin_headers
        )
        
        if success_admin and isinstance(response_admin, list):
            print(f"Admin can see {len(response_admin)} announcements")
        
        if not self.resident_headers:
            print("❌ Resident not logged in, skipping resident part")
            return success_admin
            
        success_resident, response_resident = self.run_test(
            "Get Announcements (Resident)",
            "GET",
            "api/announcements",
            200,
            headers=self.resident_headers
        )
        
        if success_resident and isinstance(response_resident, list):
            print(f"Resident can see {len(response_resident)} announcements")
        
        return success_admin and success_resident
    
    def test_whatsapp_integration(self):
        """Test WhatsApp debt reminder integration (admin only)"""
        if not self.admin_headers:
            print("❌ Admin not logged in, skipping test")
            return False
            
        success, response = self.run_test(
            "Send WhatsApp Debt Reminders",
            "POST",
            "api/whatsapp/send-debt-reminders",
            200,
            headers=self.admin_headers
        )
        
        if success:
            print(f"WhatsApp integration response: {response}")
        
        return success
    
    def test_update_household_info(self):
        """Test updating household information"""
        if not self.resident_headers or not self.apartment_id:
            print("❌ Resident not logged in or no apartment ID, skipping test")
            return False
            
        success, response = self.run_test(
            "Update Household Info",
            "PUT",
            f"api/apartments/{self.apartment_id}/household",
            200,
            headers=self.resident_headers,
            data={
                "occupant_count": 3,
                "contact_phone": "5551234567",
                "vehicles": [
                    {
                        "vehicle_type": "car",
                        "has_vehicle": True,
                        "plate_number": "34ABC123",
                        "model": "Toyota Corolla"
                    }
                ]
            }
        )
        
        return success
    
    def test_get_apartment_details(self):
        """Test getting apartment details"""
        if not self.resident_headers or not self.apartment_id:
            print("❌ Resident not logged in or no apartment ID, skipping test")
            return False
            
        success, response = self.run_test(
            "Get Apartment Details",
            "GET",
            f"api/apartments/{self.apartment_id}",
            200,
            headers=self.resident_headers
        )
        
        if success:
            print(f"Apartment details: {response}")
        
        return success
    
    def run_all_tests(self):
        """Run all API tests"""
        print("\n🚀 Starting Residence Site API Tests\n")
        
        # Authentication tests
        admin_login_success = self.test_admin_login()
        resident_login_success = self.test_resident_login()
        
        if not admin_login_success and not resident_login_success:
            print("\n❌ Authentication failed, cannot continue with tests")
            return
        
        # Admin-only endpoint tests
        self.test_get_apartments_admin()
        self.test_get_apartments_resident()  # Should fail for resident
        
        # Debt management tests
        self.test_create_debt()
        self.test_get_debts_admin()
        self.test_get_debts_resident()
        self.test_pay_debt()
        self.test_pay_debt_resident()  # Should fail for resident
        
        # Announcement tests
        self.test_create_announcement()
        self.test_create_announcement_resident()  # Should fail for resident
        self.test_get_announcements()
        
        # WhatsApp integration test
        self.test_whatsapp_integration()
        
        # Apartment management tests
        self.test_update_household_info()
        self.test_get_apartment_details()
        
        # Print test results
        print(f"\n📊 Tests completed: {self.tests_run}")
        print(f"📊 Tests passed: {self.tests_passed}")
        print(f"📊 Success rate: {(self.tests_passed / self.tests_run) * 100:.2f}%")

def main():
    # Get the backend URL from the frontend .env file
    backend_url = "https://dcba1a94-16ce-4440-8922-d72d615b57fb.preview.emergentagent.com"
    
    # Create tester instance
    tester = ResidenceSiteAPITester(backend_url)
    
    # Run all tests
    tester.run_all_tests()

if __name__ == "__main__":
    main()
