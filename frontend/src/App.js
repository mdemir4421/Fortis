import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

// Language translations
const translations = {
  tr: {
    // Login
    login: 'Giriş Yap',
    username: 'Kullanıcı Adı',
    password: 'Şifre',
    language: 'Dil',
    turkish: 'Türkçe',
    english: 'English',
    loginButton: 'Giriş',
    loginFailed: 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.',
    
    // Navigation
    dashboard: 'Ana Sayfa',
    apartments: 'Daireler',
    debts: 'Borçlar',
    announcements: 'Duyurular',
    profile: 'Profil',
    logout: 'Çıkış',
    
    // Admin Dashboard
    adminDashboard: 'Yönetici Paneli',
    createDebt: 'Borç Ekle',
    sendReminders: 'WhatsApp Hatırlatma Gönder',
    createAnnouncement: 'Duyuru Ekle',
    
    // Debt Management
    apartmentNumber: 'Daire No',
    amount: 'Tutar',
    description: 'Açıklama',
    dueDate: 'Vade Tarihi',
    debtType: 'Borç Türü',
    monthlyFee: 'Aylık Aidat',
    maintenance: 'Bakım',
    heating: 'Isıtma',
    other: 'Diğer',
    isPaid: 'Ödendi',
    paymentDate: 'Ödeme Tarihi',
    markAsPaid: 'Ödendi Olarak İşaretle',
    
    // Announcements
    title: 'Başlık',
    content: 'İçerik',
    urgent: 'Acil',
    createdDate: 'Oluşturma Tarihi',
    
    // Profile
    occupantCount: 'Kişi Sayısı',
    contactPhone: 'İletişim Telefonu',
    vehicles: 'Araçlar',
    vehicleType: 'Araç Türü',
    car: 'Otomobil',
    motorcycle: 'Motosiklet',
    hasVehicle: 'Araç Var',
    plateNumber: 'Plaka',
    model: 'Model',
    
    // Actions
    save: 'Kaydet',
    cancel: 'İptal',
    create: 'Oluştur',
    update: 'Güncelle',
    delete: 'Sil',
    edit: 'Düzenle',
    view: 'Görüntüle',
    
    // Messages
    success: 'İşlem başarılı',
    error: 'Bir hata oluştu',
    loading: 'Yükleniyor...',
    noData: 'Veri bulunamadı',
    
    // Specific messages
    debtCreated: 'Borç başarıyla eklendi',
    remindersSent: 'WhatsApp hatırlatmaları gönderildi',
    announcementCreated: 'Duyuru başarıyla eklendi',
    profileUpdated: 'Profil bilgileri güncellendi'
  },
  en: {
    // Login
    login: 'Login',
    username: 'Username',
    password: 'Password',
    language: 'Language',
    turkish: 'Türkçe',
    english: 'English',
    loginButton: 'Login',
    loginFailed: 'Login failed. Please check your credentials.',
    
    // Navigation
    dashboard: 'Dashboard',
    apartments: 'Apartments',
    debts: 'Debts',
    announcements: 'Announcements',
    profile: 'Profile',
    logout: 'Logout',
    
    // Admin Dashboard
    adminDashboard: 'Admin Dashboard',
    createDebt: 'Create Debt',
    sendReminders: 'Send WhatsApp Reminders',
    createAnnouncement: 'Create Announcement',
    
    // Debt Management
    apartmentNumber: 'Apartment No',
    amount: 'Amount',
    description: 'Description',
    dueDate: 'Due Date',
    debtType: 'Debt Type',
    monthlyFee: 'Monthly Fee',
    maintenance: 'Maintenance',
    heating: 'Heating',
    other: 'Other',
    isPaid: 'Paid',
    paymentDate: 'Payment Date',
    markAsPaid: 'Mark as Paid',
    
    // Announcements
    title: 'Title',
    content: 'Content',
    urgent: 'Urgent',
    createdDate: 'Created Date',
    
    // Profile
    occupantCount: 'Occupant Count',
    contactPhone: 'Contact Phone',
    vehicles: 'Vehicles',
    vehicleType: 'Vehicle Type',
    car: 'Car',
    motorcycle: 'Motorcycle',
    hasVehicle: 'Has Vehicle',
    plateNumber: 'Plate Number',
    model: 'Model',
    
    // Actions
    save: 'Save',
    cancel: 'Cancel',
    create: 'Create',
    update: 'Update',
    delete: 'Delete',
    edit: 'Edit',
    view: 'View',
    
    // Messages
    success: 'Operation successful',
    error: 'An error occurred',
    loading: 'Loading...',
    noData: 'No data found',
    
    // Specific messages
    debtCreated: 'Debt created successfully',
    remindersSent: 'WhatsApp reminders sent',
    announcementCreated: 'Announcement created successfully',
    profileUpdated: 'Profile information updated'
  }
};

function App() {
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [language, setLanguage] = useState('tr');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // Data states
  const [apartments, setApartments] = useState([]);
  const [debts, setDebts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [selectedApartment, setSelectedApartment] = useState(null);
  
  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [debtForm, setDebtForm] = useState({
    apartment_id: '',
    amount: '',
    description: '',
    due_date: '',
    debt_type: 'monthly_fee'
  });
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    content: '',
    is_urgent: false
  });

  const t = translations[language];

  useEffect(() => {
    // Load language from cookie
    const savedLanguage = document.cookie
      .split('; ')
      .find(row => row.startsWith('language='))
      ?.split('=')[1] || 'tr';
    setLanguage(savedLanguage);
    
    // Check if user is logged in
    const token = localStorage.getItem('token');
    if (token) {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(userData);
      loadInitialData();
    }
  }, []);

  const saveLanguageToCookie = (lang) => {
    document.cookie = `language=${lang}; path=/; max-age=31536000`; // 1 year
    setLanguage(lang);
  };

  const showMessage = (msg, isError = false) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  const apiCall = async (endpoint, method = 'GET', data = null) => {
    try {
      const token = localStorage.getItem('token');
      const config = {
        method,
        url: `${API_BASE_URL}/api${endpoint}`,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        ...(data && { data })
      };
      
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('API Error:', error);
      if (error.response?.status === 401) {
        logout();
      }
      throw error;
    }
  };

  const login = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await apiCall('/auth/login', 'POST', {
        ...loginForm,
        language
      });
      
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
      
      // Load initial data based on user role
      try {
        const promises = [loadDebts(), loadAnnouncements()];
        if (response.user.role === 'admin') {
          promises.push(loadApartments());
        }
        await Promise.all(promises);
      } catch (dataError) {
        console.error('Error loading initial data:', dataError);
      }
      
      showMessage(t.success);
    } catch (error) {
      showMessage(t.loginFailed, true);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setCurrentView('dashboard');
  };

  const loadInitialData = async () => {
    try {
      const promises = [loadDebts(), loadAnnouncements()];
      if (user?.role === 'admin') {
        promises.push(loadApartments());
      }
      await Promise.all(promises);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadApartments = async () => {
    try {
      const data = await apiCall('/apartments');
      setApartments(data);
    } catch (error) {
      console.error('Error loading apartments:', error);
    }
  };

  const loadDebts = async () => {
    try {
      const data = await apiCall('/debts');
      setDebts(data);
    } catch (error) {
      console.error('Error loading debts:', error);
    }
  };

  const loadAnnouncements = async () => {
    try {
      const data = await apiCall('/announcements');
      setAnnouncements(data);
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
  };

  const createDebt = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await apiCall('/debts', 'POST', debtForm);
      setDebtForm({
        apartment_id: '',
        amount: '',
        description: '',
        due_date: '',
        debt_type: 'monthly_fee'
      });
      loadDebts();
      setCurrentView('debts'); // Navigate to debts view to see the new debt
      showMessage(t.debtCreated);
    } catch (error) {
      showMessage(t.error, true);
    } finally {
      setLoading(false);
    }
  };

  const markDebtPaid = async (debtId) => {
    try {
      await apiCall(`/debts/${debtId}/pay`, 'POST');
      loadDebts();
      showMessage(t.success);
    } catch (error) {
      showMessage(t.error, true);
    }
  };

  const sendWhatsAppReminders = async () => {
    setLoading(true);
    try {
      const result = await apiCall('/whatsapp/send-debt-reminders', 'POST');
      showMessage(`${t.remindersSent}: ${result.sent_count} mesaj gönderildi`);
    } catch (error) {
      showMessage(t.error, true);
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await apiCall('/announcements', 'POST', announcementForm);
      setAnnouncementForm({ title: '', content: '', is_urgent: false });
      loadAnnouncements();
      setCurrentView('announcements'); // Navigate to announcements view to see the new announcement
      showMessage(t.announcementCreated);
    } catch (error) {
      showMessage(t.error, true);
    } finally {
      setLoading(false);
    }
  };

  // Login Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          {/* Language Selector */}
          <div className="mb-6 text-center">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <button
                onClick={() => saveLanguageToCookie('tr')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  language === 'tr' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-700 hover:text-blue-500'
                }`}
              >
                {t.turkish}
              </button>
              <button
                onClick={() => saveLanguageToCookie('en')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  language === 'en' 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-700 hover:text-blue-500'
                }`}
              >
                {t.english}
              </button>
            </div>
          </div>

          {/* Login Form */}
          <div className="bg-white rounded-lg shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900">{t.login}</h1>
              <p className="text-gray-600 mt-2">Residence Site Management</p>
            </div>

            <form onSubmit={login} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.username}
                </label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="apartment01, shop01, admin"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.password}
                </label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? t.loading : t.loginButton}
              </button>
            </form>

            {message && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Main Application
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {user.role === 'admin' ? t.adminDashboard : `${user.apartment_number}`}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Navigation Links */}
              <div className="hidden md:flex space-x-4">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'dashboard' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t.dashboard}
                </button>
                
                {user.role === 'admin' && (
                  <button
                    onClick={() => setCurrentView('apartments')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      currentView === 'apartments' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t.apartments}
                  </button>
                )}
                
                <button
                  onClick={() => setCurrentView('debts')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'debts' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t.debts}
                </button>
                
                <button
                  onClick={() => setCurrentView('announcements')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    currentView === 'announcements' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {t.announcements}
                </button>
                
                {user.role === 'resident' && (
                  <button
                    onClick={() => setCurrentView('profile')}
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      currentView === 'profile' 
                        ? 'bg-blue-100 text-blue-700' 
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {t.profile}
                  </button>
                )}
              </div>

              {/* Language Switcher */}
              <div className="flex border rounded-lg">
                <button
                  onClick={() => saveLanguageToCookie('tr')}
                  className={`px-2 py-1 text-xs font-medium rounded-l-lg ${
                    language === 'tr' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  TR
                </button>
                <button
                  onClick={() => saveLanguageToCookie('en')}
                  className={`px-2 py-1 text-xs font-medium rounded-r-lg ${
                    language === 'en' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  EN
                </button>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                {t.logout}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Message Display */}
      {message && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-green-50 border border-green-200 text-green-700 p-3 rounded-lg">
            {message}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">{t.dashboard}</h2>
            
            {user.role === 'admin' ? (
              // Admin Dashboard
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Quick Stats */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Total Apartments</h3>
                  <p className="text-3xl font-bold text-blue-600">{apartments.length}</p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Unpaid Debts</h3>
                  <p className="text-3xl font-bold text-red-600">
                    {debts.filter(debt => !debt.is_paid).length}
                  </p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Total Debt Amount</h3>
                  <p className="text-3xl font-bold text-orange-600">
                    {debts.filter(debt => !debt.is_paid)
                      .reduce((sum, debt) => sum + debt.amount, 0).toFixed(2)} TL
                  </p>
                </div>

                {/* Quick Actions */}
                <div className="col-span-full">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={() => setCurrentView('create-debt')}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
                    >
                      {t.createDebt}
                    </button>
                    <button
                      onClick={sendWhatsAppReminders}
                      disabled={loading}
                      className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 disabled:opacity-50"
                    >
                      {loading ? t.loading : t.sendReminders}
                    </button>
                    <button
                      onClick={() => setCurrentView('create-announcement')}
                      className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600"
                    >
                      {t.createAnnouncement}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              // Resident Dashboard
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">My Debts</h3>
                  <p className="text-3xl font-bold text-red-600">
                    {debts.filter(debt => !debt.is_paid).length}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Unpaid debts</p>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Total Amount</h3>
                  <p className="text-3xl font-bold text-orange-600">
                    {debts.filter(debt => !debt.is_paid)
                      .reduce((sum, debt) => sum + debt.amount, 0).toFixed(2)} TL
                  </p>
                  <p className="text-sm text-gray-600 mt-1">Outstanding balance</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Create Debt View (Admin Only) */}
        {currentView === 'create-debt' && user.role === 'admin' && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.createDebt}</h2>
            
            {/* Load apartments if not loaded */}
            {apartments.length === 0 && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-700">Loading apartments...</p>
                <button
                  onClick={loadApartments}
                  className="mt-2 text-blue-600 hover:text-blue-800 underline"
                >
                  Click here if apartments don't load automatically
                </button>
              </div>
            )}
            
            <div className="bg-white p-6 rounded-lg shadow">
              <form onSubmit={createDebt} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.apartmentNumber}
                  </label>
                  <select
                    value={debtForm.apartment_id}
                    onChange={(e) => setDebtForm({...debtForm, apartment_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select apartment...</option>
                    {apartments.map(apt => (
                      <option key={apt.id} value={apt.id}>
                        {apt.apartment_number} ({apt.unit_type})
                      </option>
                    ))}
                  </select>
                  {apartments.length === 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      No apartments loaded. Please click the button above to load apartments.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.amount}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={debtForm.amount}
                    onChange={(e) => setDebtForm({...debtForm, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.description}
                  </label>
                  <input
                    type="text"
                    value={debtForm.description}
                    onChange={(e) => setDebtForm({...debtForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.dueDate}
                  </label>
                  <input
                    type="date"
                    value={debtForm.due_date}
                    onChange={(e) => setDebtForm({...debtForm, due_date: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.debtType}
                  </label>
                  <select
                    value={debtForm.debt_type}
                    onChange={(e) => setDebtForm({...debtForm, debt_type: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="monthly_fee">{t.monthlyFee}</option>
                    <option value="maintenance">{t.maintenance}</option>
                    <option value="heating">{t.heating}</option>
                    <option value="other">{t.other}</option>
                  </select>
                </div>

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {loading ? t.loading : t.create}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('dashboard')}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                  >
                    {t.cancel}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Debts View */}
        {currentView === 'debts' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.debts}</h2>
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {user.role === 'admin' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {t.apartmentNumber}
                        </th>
                      )}
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t.description}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t.amount}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t.dueDate}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {t.isPaid}
                      </th>
                      {user.role === 'admin' && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {debts.map(debt => (
                      <tr key={debt.id}>
                        {user.role === 'admin' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {debt.apartment_number}
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {debt.description}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {debt.amount.toFixed(2)} TL
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(debt.due_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            debt.is_paid 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {debt.is_paid ? 'Paid' : 'Unpaid'}
                          </span>
                        </td>
                        {user.role === 'admin' && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {!debt.is_paid && (
                              <button
                                onClick={() => markDebtPaid(debt.id)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                {t.markAsPaid}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Announcements View */}
        {currentView === 'announcements' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.announcements}</h2>
            
            <div className="space-y-4">
              {announcements.map(announcement => (
                <div key={announcement.id} className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        {announcement.title}
                        {announcement.is_urgent && (
                          <span className="ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            {t.urgent}
                          </span>
                        )}
                      </h3>
                      <p className="text-gray-700 mb-3">{announcement.content}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(announcement.created_date).toLocaleDateString()} 
                        {' '}{new Date(announcement.created_date).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Create Announcement View (Admin Only) */}
        {currentView === 'create-announcement' && user.role === 'admin' && (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t.createAnnouncement}</h2>
            
            <div className="bg-white p-6 rounded-lg shadow">
              <form onSubmit={createAnnouncement} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.title}
                  </label>
                  <input
                    type="text"
                    value={announcementForm.title}
                    onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t.content}
                  </label>
                  <textarea
                    value={announcementForm.content}
                    onChange={(e) => setAnnouncementForm({...announcementForm, content: e.target.value})}
                    rows="4"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  ></textarea>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="urgent"
                    checked={announcementForm.is_urgent}
                    onChange={(e) => setAnnouncementForm({...announcementForm, is_urgent: e.target.checked})}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="urgent" className="ml-2 block text-sm text-gray-700">
                    {t.urgent}
                  </label>
                </div>

                <div className="flex space-x-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
                  >
                    {loading ? t.loading : t.create}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentView('dashboard')}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                  >
                    {t.cancel}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;