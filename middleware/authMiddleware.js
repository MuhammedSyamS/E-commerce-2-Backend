const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * protect: Standard MNC-grade middleware for JWT validation
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Check if Authorization header exists and starts with Bearer
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 2. Extract token
      token = req.headers.authorization.split(' ')[1];

      // 3. Verify token with Secret Key
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 4. Find user (checking both 'id' and '_id' for flexibility)
      const userId = decoded.id || decoded._id;
      req.user = await User.findById(userId).select('-password');

      if (!req.user) {
        return res.status(401).json({ message: 'User not found, access denied' });
      }

      // 5. Proceed to the next middleware/controller
      return next();

    } catch (error) {
      console.error('Auth Error:', error.message);
      return res.status(401).json({ message: 'Session expired or invalid token' });
    }
  }

  // 6. Handle cases where no token was provided at all
  if (!token) {
    return res.status(401).json({ message: 'No token provided, please login' });
  }
};

/**
 * admin: Middleware to restrict access to admin users only
 */
const admin = (req, res, next) => {
  if (req.user && (req.user.isAdmin || req.user.role === 'admin')) {
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
    // Super Admins have full access
    if (req.user.isSuperAdmin) return next();

    // Check specific permission
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      next();
    } else {
      res.status(403).json({ message: 'Not authorized: Insufficient permissions' });
    }
  };
};

module.exports = { protect, admin, manager, hasPermission };