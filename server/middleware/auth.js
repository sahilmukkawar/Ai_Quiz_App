import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find user by id
      const user = await User.findById(decoded.userId).select('-password');

      if (!user) {
        throw new Error('User not found');
      }

      // Add user info to request object
      req.user = user;
      req.user.userId = user._id; // Ensure userId is available

      next();
    } catch (error) {
      console.error('Auth middleware error:', error.message);

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ message: 'Invalid token' });
      } else if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expired' });
      } else {
        return res.status(401).json({ message: 'Authentication failed' });
      }
    }
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export default auth;