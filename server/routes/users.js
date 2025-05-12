import express from 'express';
import auth from '../middleware/auth.js';
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Get authenticated user
router.get('/me', auth, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user profile
router.patch('/me', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['name', 'currentPassword', 'password'];
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).json({ message: 'Invalid updates' });
  }

  try {
    // If updating password
    if (updates.includes('password') || updates.includes('currentPassword')) {
      const { currentPassword, password } = req.body;

      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required' });
      }

      if (!password) {
        return res.status(400).json({ message: 'New password is required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters' });
      }

      // Get the complete user with password from database
      const userWithPassword = await User.findById(req.user._id);

      if (!userWithPassword) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const isMatch = await userWithPassword.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }

      // Hash the new password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Update password
      await User.findByIdAndUpdate(req.user._id, { password: hashedPassword });

      // Return success message
      return res.json({
        message: 'Password updated successfully',
        name: userWithPassword.name
      });
    }

    // Update name if provided
    if (updates.includes('name')) {
      const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { name: req.body.name },
        { new: true }
      ).select('-password');

      return res.json(updatedUser);
    }

    // If we get here with no valid updates
    return res.status(400).json({ message: 'No valid updates provided' });

  } catch (error) {
    console.error('Update error:', error);
    res.status(400).json({ message: error.message || 'Failed to update user' });
  }
});

// Delete user account
router.delete('/me', auth, async (req, res) => {
  try {
    await User.deleteOne({ _id: req.user._id });
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;