// (4.22208334636).fixed(n) will return fixed point value to n places, default n = 3
export default function fixed (val, n=3) {
	return parseFloat(val.toFixed(n));
}
