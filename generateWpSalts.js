import crypto from 'crypto';

const getRandom = (min, max) => {
	let rval = 0;
	const range = max - min;
  
	const bits_needed = Math.ceil(Math.log2(range));
	if (bits_needed > 53) {
	  throw new Error("We cannot generate numbers larger than 53 bits.");
	}
	const bytes_needed = Math.ceil(bits_needed / 8);
	const mask = Math.pow(2, bits_needed) - 1;
  
	// Create byte array and fill with N random numbers
	const byteArray = Buffer.alloc(bytes_needed);
	crypto.randomFillSync(byteArray);
  
	let p = (bytes_needed - 1) * 8;
	for (let i = 0; i < bytes_needed; i++) {
	  rval += byteArray[i] * Math.pow(2, p);
	  p -= 8;
	}
  
	// Use & to apply the mask and reduce the number of recursive lookups
	rval = rval & mask;
  
	if (rval >= range) {
	  // Integer out of acceptable range
	  return getRandom(min, max);
	}
	// Return an integer that falls within the range
	return min + rval;
};

const getRandomChar = () => {
const minChar = 33; // !
const maxChar = 126; // ~
const char = String.fromCharCode(getRandom(minChar, maxChar));
if (["'", "\"", "\\", ";"].some(badChar => char === badChar)) {
	return getRandomChar();
}

return char;
};

const generateSalt = () => {
return Array(64)
	.fill(0)
	.map(getRandomChar)
	.join('');
};

const generateSaltsObj = (keys) => {
	return keys.reduce((salts, key) => {
		salts[key] = generateSalt();
		return salts;
	}, {});
};
  
const keys = [
	'AUTH_KEY',
	'SECURE_AUTH_KEY',
	'LOGGED_IN_KEY',
	'NONCE_KEY',
	'AUTH_SALT',
	'SECURE_AUTH_SALT',
	'LOGGED_IN_SALT',
	'NONCE_SALT',
];

export default generateSaltsObj(keys);
