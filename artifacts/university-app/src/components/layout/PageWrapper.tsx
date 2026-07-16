import React from 'react';

const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  return <div className="animate-page">{children}</div>;
};

export default PageWrapper;
