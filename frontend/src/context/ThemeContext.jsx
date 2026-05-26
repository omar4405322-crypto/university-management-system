import React, { createContext, useContext, useState, useEffect } from 'react'; 
 
 const ThemeContext = createContext(); 
 export const useTheme = () => useContext(ThemeContext); 
 
 export const ThemeProvider = ({ children }) => { 
   const [isDark, setIsDark] = useState(() => { 
     const saved = localStorage.getItem('theme'); 
     return saved === 'dark'; 
   }); 
 
   useEffect(() => { 
     const root = document.documentElement; 
     if (isDark) { 
       root.classList.add('dark'); 
       root.classList.remove('light'); 
       localStorage.setItem('theme', 'dark'); 
     } else { 
       root.classList.remove('dark'); 
       root.classList.add('light'); 
       localStorage.setItem('theme', 'light'); 
     } 
   }, [isDark]); 
 
   const toggleTheme = () => { 
     setIsDark(prev => !prev); 
   }; 
 
   return ( 
     <ThemeContext.Provider value={{ isDark, toggleTheme }}> 
       {children} 
     </ThemeContext.Provider> 
   ); 
 }; 
