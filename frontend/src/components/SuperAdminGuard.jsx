// FIXED: No longer redirects — all routes accessible; use SuperAdminTwoFactorBanner for reminder
import React from 'react';

const SuperAdminGuard = ({ children }) => children;

export default SuperAdminGuard;
