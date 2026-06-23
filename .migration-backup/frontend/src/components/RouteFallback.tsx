// FIXED: Shared Suspense fallback for lazy-loaded routes - Phase 1
import React from 'react';
import LoadingState from './ui/LoadingState';

const RouteFallback = ({ message = 'Loading page...' }) => (
  <div className="min-h-[400px] flex items-center justify-center">
    <LoadingState message={message} />
  </div>
);

export default RouteFallback;
