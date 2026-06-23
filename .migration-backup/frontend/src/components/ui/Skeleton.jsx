import React from 'react'; 
 
 const Skeleton = ({ className = '', variant = 'text', count = 1 }) => { 
   const base = 'animate-pulse bg-slate-200 dark:bg-slate-700 rounded'; 
   
   const variants = { 
     text:  'h-4 w-full rounded', 
     title: 'h-6 w-3/4 rounded', 
     card:  'h-32 w-full rounded-2xl', 
     kpi:   'h-28 w-full rounded-2xl', 
     row:   'h-12 w-full rounded-xl', 
     avatar:'h-10 w-10 rounded-full', 
     circle:'rounded-full', 
   }; 
 
   return ( 
     <> 
       {Array.from({ length: count }).map((_, i) => ( 
         <div 
           key={i} 
           className={`${base} ${variants[variant]} ${className}`} 
           aria-hidden="true" 
         /> 
       ))} 
     </> 
   ); 
 }; 
 
 export const SkeletonCard = () => ( 
   <div className="card-default p-6 space-y-4"> 
     <Skeleton variant="title" /> 
     <Skeleton variant="text" count={3} className="mb-2" /> 
   </div> 
 ); 
 
 export const SkeletonTable = ({ rows = 5 }) => ( 
   <div className="space-y-3"> 
     <Skeleton variant="row" className="opacity-60" /> 
     {Array.from({ length: rows }).map((_, i) => ( 
       <Skeleton key={i} variant="row" /> 
     ))} 
   </div> 
 ); 
 
 export const SkeletonKPIGrid = () => ( 
   <div className="grid grid-cols-2 lg:grid-cols-4 gap-5"> 
     {Array.from({ length: 4 }).map((_, i) => ( 
       <Skeleton key={i} variant="kpi" /> 
     ))} 
   </div> 
 ); 
 
 export default Skeleton; 
