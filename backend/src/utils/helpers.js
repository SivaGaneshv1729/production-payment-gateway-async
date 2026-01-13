const generateId = (prefix) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return prefix + result;
};

const validateLuhn = (num) => {
    const cleanNum = (num + '').replace(/[\s-]/g, '');
    if (!/^\d+$/.test(cleanNum)) return false;
    if (cleanNum.length < 13 || cleanNum.length > 19) return false;
    let arr = cleanNum.split('').reverse().map(x => parseInt(x));
    let lastDigit = arr.splice(0, 1)[0];
    let sum = arr.reduce((acc, val, i) => (i % 2 !== 0 ? acc + val : acc + ((val * 2) % 9) || 9), 0);
    sum += lastDigit;
    return sum % 10 === 0;
};

const getCardNetwork = (num) => {
    const cleanNum = (num + '').replace(/[\s-]/g, '');
    if (/^4/.test(cleanNum)) return 'visa';
    if (/^5[1-5]/.test(cleanNum)) return 'mastercard';
    if (/^3[47]/.test(cleanNum)) return 'amex';
    if (/^60|^65|^8[1-9]/.test(cleanNum)) return 'rupay';
    return 'unknown';
};

module.exports = {
    generateId,
    validateLuhn,
    getCardNetwork
};
