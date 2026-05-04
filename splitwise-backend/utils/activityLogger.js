const Activity = require('../models/Activity');

/**
 * Log an activity to the history feed.
 * @param {Object} params
 * @param {String} params.groupId - ID of the group
 * @param {String} params.userId - ID of the user performing the action
 * @param {String} params.action - Action type (e.g., 'created', 'updated', 'deleted', 'paid')
 * @param {String} params.type - Entity type (e.g., 'expense', 'settlement')
 * @param {String} params.description - Human readable summary
 * @param {Number} [params.amount] - Optional amount
 */
async function logActivity({ groupId, userId, action, type, description, amount }) {
  try {
    const activity = new Activity({
      group: groupId,
      user: userId,
      action,
      type,
      description,
      amount
    });
    await activity.save();
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
}

module.exports = { logActivity };
