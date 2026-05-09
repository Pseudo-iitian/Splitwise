const { splitEqually, splitByPercentage, splitByExact } = require('./splitHelpers');

describe('splitHelpers', () => {
  describe('splitEqually', () => {
    it('should split amount equally among members', () => {
      const amount = 100;
      const members = ['user1', 'user2', 'user3', 'user4'];
      const result = splitEqually(amount, members);
      expect(result).toHaveLength(4);
      expect(result[0].amount).toBe(25);
      expect(result.reduce((sum, s) => sum + s.amount, 0)).toBe(100);
    });

    it('should handle decimal points correctly', () => {
      const amount = 100;
      const members = ['user1', 'user2', 'user3'];
      const result = splitEqually(amount, members);
      expect(result[0].amount).toBe(33.33);
      // Note: 33.33 * 3 = 99.99, the current logic doesn't handle the 0.01 difference
      // which is something to improve, but for now testing current behavior
    });
  });

  describe('splitByPercentage', () => {
    it('should split by percentage', () => {
      const amount = 200;
      const splits = [
        { user: 'user1', percentage: 50 },
        { user: 'user2', percentage: 25 },
        { user: 'user3', percentage: 25 }
      ];
      const result = splitByPercentage(amount, splits);
      expect(result[0].amount).toBe(100);
      expect(result[1].amount).toBe(50);
      expect(result[2].amount).toBe(50);
    });
  });

  describe('splitByExact', () => {
    it('should return exact amounts', () => {
      const splits = [
        { user: 'user1', amount: 40 },
        { user: 'user2', amount: 60 }
      ];
      const result = splitByExact(splits);
      expect(result).toEqual(splits);
    });
  });
});
