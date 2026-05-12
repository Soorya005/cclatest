export const validateUsername = (username: string): boolean => {
    // Alphanumeric, underscores, 3-20 chars
    const regex = /^[a-zA-Z0-9_]{3,20}$/;
    return regex.test(username);
};

export const validatePasswordStrength = (password: string): { valid: boolean; message: string } => {
    if (password.length < 8) {
        return { valid: false, message: "Password must be at least 8 characters long." };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: "Password must contain at least one uppercase letter." };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: "Password must contain at least one number." };
    }
    return { valid: true, message: "Password is strong." };
};
