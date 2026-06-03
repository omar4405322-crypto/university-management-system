import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { 
  LogOut, User as UserIcon, BookOpen, Users, Book, 
  UserCheck, Calendar, ClipboardList, DollarSign, 
  Building, Layers, UserPlus, HelpCircle, CheckSquare,
  Sun, Moon, Globe, ChevronDown, UserCircle, Menu, X
} from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const mobileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
    setIsMobileMenuOpen(false);
    navigate('/login');
  };

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const getInitials = () => {
    if (!user) return '?';
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email.substring(0, 2).toUpperCase();
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'COLLEGE_ADMIN' || user?.role === 'DEPARTMENT_ADMIN';
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN';

  const NavLinks = () => (
    <>
      <Link to="/dashboard" onClick={closeMobileMenu} className="flex items-center text-gray-600 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition duration-150 py-3 px-4 md:py-0 md:px-0 border-b border-gray-50 dark:border-gray-700/50 md:border-0">
        <span className="">{t('nav.dashboard')}</span>
      </Link>

      <Link to="/courses" onClick={closeMobileMenu} className="flex items-center text-gray-600 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition duration-150 py-3 px-4 md:py-0 md:px-0 border-b border-gray-50 dark:border-gray-700/50 md:border-0">
        <Book size={18} className="mr-3 md:mr-1 rtl:ml-3 md:rtl:ml-1" />
        <span className="">{t('nav.courses')}</span>
      </Link>
      
      {(user?.role === 'STUDENT' || user?.role === 'DOCTOR') && (
        <>
          <Link to="/quizzes" onClick={closeMobileMenu} className="flex items-center text-gray-600 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition duration-150 py-3 px-4 md:py-0 md:px-0 border-b border-gray-50 dark:border-gray-700/50 md:border-0">
            <HelpCircle size={18} className="mr-3 md:mr-1 rtl:ml-3 md:rtl:ml-1" />
            <span className="">{t('nav.quizzes')}</span>
          </Link>
          <Link to="/tasks" onClick={closeMobileMenu} className="flex items-center text-gray-600 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition duration-150 py-3 px-4 md:py-0 md:px-0 border-b border-gray-50 dark:border-gray-700/50 md:border-0">
            <CheckSquare size={18} className="mr-3 md:mr-1 rtl:ml-3 md:rtl:ml-1" />
            <span className="">{t('nav.tasks')}</span>
          </Link>
        </>
      )}

      <Link to="/schedule" onClick={closeMobileMenu} className="flex items-center text-gray-600 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition duration-150 py-3 px-4 md:py-0 md:px-0 border-b border-gray-50 dark:border-gray-700/50 md:border-0">
        <Calendar size={18} className="mr-3 md:mr-1 rtl:ml-3 md:rtl:ml-1" />
        <span className="">{t('nav.schedule')}</span>
      </Link>

      {isAdmin && (
        <>
          {isSuperAdmin && (
            <Link to="/colleges" onClick={closeMobileMenu} className="flex items-center text-gray-600 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition duration-150 py-3 px-4 md:py-0 md:px-0 border-b border-gray-50 dark:border-gray-700/50 md:border-0">
              <Building size={18} className="mr-3 md:mr-1 rtl:ml-3 md:rtl:ml-1" />
              <span className="">{t('nav.colleges')}</span>
            </Link>
          )}
          
          {(user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.role === 'COLLEGE_ADMIN') && (
            <Link to="/departments" onClick={closeMobileMenu} className="flex items-center text-gray-600 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition duration-150 py-3 px-4 md:py-0 md:px-0 border-b border-gray-50 dark:border-gray-700/50 md:border-0">
              <Layers size={18} className="mr-3 md:mr-1 rtl:ml-3 md:rtl:ml-1" />
              <span className="">{t('nav.departments')}</span>
            </Link>
          )}

          <Link to="/registration-requests" onClick={closeMobileMenu} className="flex items-center text-gray-600 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium text-sm transition duration-150 py-3 px-4 md:py-0 md:px-0 border-b border-gray-50 dark:border-gray-700/50 md:border-0">
            <UserPlus size={18} className="mr-3 md:mr-1 rtl:ml-3 md:rtl:ml-1" />
            <span className="">{t('nav.requests')}</span>
          </Link>
        </>
      )}
    </>
  );

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 mr-2 rtl:ml-2 rtl:mr-0 md:hidden text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            
            <Link to="/" className="flex items-center text-blue-600 font-bold text-xl mr-6 rtl:ml-6">
              <img 
                src="/assets/university/logo.svg" 
                alt="Logo" 
                className="h-8 w-auto mr-2 rtl:ml-2"
              />
              <span className="hidden sm:inline">6th of October University</span>
              <span className="sm:hidden">6th Oct Univ</span>
            </Link>
            
            <div className="hidden md:flex items-center space-x-4 lg:space-x-6 rtl:space-x-reverse">
              {user && <NavLinks />}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {/* Dark Mode Toggle */}
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors" 
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'} 
            > 
              {isDark ? <Sun size={20} className="text-yellow-400" /> : <Moon size={20} className="text-gray-600" />} 
            </button> 

            {/* Language Toggle */}
            <button 
              onClick={toggleLanguage} 
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 transition-colors"
            >
              <Globe size={16} />
              <span className="hidden xs:inline">{i18n.language === 'ar' ? 'EN' : 'عربي'}</span>
              <span className="xs:hidden">{i18n.language === 'ar' ? 'E' : 'ع'}</span>
            </button>

            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                    {getInitials()}
                  </div>
                  <ChevronDown size={16} className={`hidden sm:block text-gray-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 rtl:left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-100 dark:border-gray-700 py-1 z-50 animate-in fade-in zoom-in duration-100">
                    <div className="px-4 py-2 border-b dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400 font-medium truncate">{user.email}</p>
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{user.role.replace('_', ' ')}</p>
                    </div>
                    
                    <Link 
                      to="/profile" 
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <UserCircle size={16} className="mr-2 rtl:ml-2" />
                      {t('nav.profile') || 'Profile'}
                    </Link>
                    
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <LogOut size={16} className="mr-2 rtl:ml-2" />
                      {t('nav.logout')}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2 sm:space-x-4 rtl:space-x-reverse">
                <Link to="/login" className="text-gray-700 dark:text-gray-200 hover:text-blue-600 font-medium text-sm">{t('auth.login')}</Link>
                <Link to="/register" className="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700 font-medium text-sm transition duration-150">{t('auth.register')}</Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 animate-in slide-in-from-top duration-200">
          <div className="px-4 pt-2 pb-6 space-y-1 sm:px-3 flex flex-col" ref={mobileMenuRef}>
            {user ? (
              <NavLinks />
            ) : (
              <div className="pt-4 pb-3 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col space-y-2">
                  <Link to="/login" onClick={closeMobileMenu} className="text-gray-700 dark:text-gray-200 hover:text-blue-600 font-medium text-base py-2">{t('auth.login')}</Link>
                  <Link to="/register" onClick={closeMobileMenu} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 font-medium text-base text-center transition duration-150">{t('auth.register')}</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
