// @ts-nocheck
// DEV-ONLY: Test component to verify ErrorBoundary catches render errors
// This component intentionally throws an error on render
import React from 'react';

const ErrorBoundaryTest = () => {
  // Intentionally throw to test ErrorBoundary
  throw new Error('Test error: ErrorBoundary is working correctly!');

  // This line will never be reached
  return <div>This should not render</div>;
};

export default ErrorBoundaryTest;