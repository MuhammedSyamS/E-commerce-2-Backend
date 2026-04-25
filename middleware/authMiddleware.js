const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect: Standard MNC-grade middleware for JWT validation
 */
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 1. Fetch user with status flags
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({ success: false, message: 'USER_NOT_FOUND', code: 'AUTH_001' });
      }

      // 2. CHECK STATUS (ZERO TRUST)
      if (user.isBlocked) {
        return res.status(403).json({ success: false, message: 'ACCOUNT_BLOCKED', code: 'AUTH_002' });
      }

      if (user.isDeleted) {
        return res.status(403).json({ success: false, message: 'ACCOUNT_DELETED', code: 'AUTH_003' });
      }

      // 3. TOKEN VERSION VALIDATION (Instant Logout Support)
      if (typeof decoded.tokenVersion !== 'undefined' && decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({ success: false, message: 'SESSION_REVOKED', code: 'AUTH_004' });
      }

      req.user = user;
      return next();

    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'TOKEN_EXPIRED', code: 'AUTH_005' });
      }
      return res.status(401).json({ success: false, message: 'INVALID_SESSION', code: 'AUTH_006' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'NOT_AUTHENTICATED', code: 'AUTH_007' });
  }
};

/**
 * admin: Middleware to restrict access to admin users only
 */
const admin = (req, res, next) => {
  const isStaff = req.user && (req.user.isAdmin || ['admin', 'manager', 'client_support_executive', 'digital_marketing_executive'].includes(req.user.role));
  if (isStaff) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Requires administrator privileges' });
  }
};

const manager = (req, res, next) => {
  if (req.user && (req.user.isAdmin || req.user.role === 'admin' || req.user.role === 'manager')) {
    next();
  } else {
    res.status(403).json({ message: 'Access denied: Requires manager or admin privileges' });
  }
};

const hasPermission = (permission) => {
  return (req, res, next) => {
    // Super Admins & Admins have full access
    if (req.user.isAdmin || req.user.role === 'admin' || req.user.isSuperAdmin) {
      return next();
    }

    // Role-based baseline permissions
    if (permission === 'manage_support' && req.user.role === 'client_support_executive') return next();
    if (permission === 'manage_reviews' && req.user.role === 'client_support_executive') return next();
    if (permission === 'manage_looks' && req.user.role === 'client_support_executive') return next();
    if (permission === 'manage_blog' && req.user.role === 'digital_marketing_executive') return next();
    if (permission === 'manage_products' && req.user.role === 'digital_marketing_executive') return next();

    // Check specific permission
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      next();
    } else {
      res.status(403).json({ message: 'Not authorized: Insufficient permissions' });
    }
  };
};

module.exports = { protect, admin, manager, hasPermission };
