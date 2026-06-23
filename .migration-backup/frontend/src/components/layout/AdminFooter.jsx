import React from 'react'; 
import { useTranslation } from 'react-i18next'; 
import { UNIVERSITY_LOGO } from '../../constants/universityAssets'; 
 
const AdminFooter = () => { 
  const { t } = useTranslation(); 
  const currentYear = new Date().getFullYear(); 
 
  return ( 
    <footer className="shrink-0 border-t border-brand-border bg-brand-bg-page"> 
      <div className="px-6 py-3 flex items-center justify-between"> 
        <div className="flex items-center gap-2"> 
          <img 
            src={UNIVERSITY_LOGO} 
            alt="University Logo" 
            className="h-5 w-5 object-contain opacity-60" 
            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
          /> 
          <span className="text-xs text-brand-text-muted font-medium"> 
            {t('footer.universityName')} © {currentYear} 
          </span> 
        </div> 
        <span className="text-xs text-brand-text-muted"> 
          v1.0.0 
        </span> 
      </div> 
    </footer> 
  ); 
}; 
 
export default AdminFooter; 
