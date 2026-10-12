
const cache = new Map();
const pending = new Map();

let lastRequestAt = 0;
let queue = Promise.resolve();

const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

const reverseGeocode = async (latitude, longitude) => {
    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    const userAgent = process.env.GEOCODER_USER_AGENT;

    if (!userAgent) {
        console.warn("GEOCODER_USER_AGENT is not configured");
        return null;
    }

    const key = `${latitude.toFixed(4)},${longitude.toFixed(4)}`;

    if (cache.has(key)) {
        return cache.get(key);
    }

    if (pending.has(key)) {
        return pending.get(key);
    }

    const task = queue.then(async () => {
        const elapsed = Date.now() - lastRequestAt;

        if (elapsed < 1100) {
            await wait(1100 - elapsed);
        }

        lastRequestAt = Date.now();

        const url =
            "https://nominatim.openstreetmap.org/reverse" +
            `?format=jsonv2&lat=${latitude}&lon=${longitude}` +
            "&zoom=17&addressdetails=1&accept-language=en";

        try {
            const response = await fetch(url, {
                headers: {
                    "User-Agent": userAgent,
                    "Accept": "application/json",
                    "Accept-Language": "en",
                },
                signal: AbortSignal.timeout(8000),
            });

            if (!response.ok) {
                console.warn("Geocoding HTTP status:", response.status);
                return null;
            }

            const data = await response.json();
            const a = data.address || {};

            const parts = [
                a.road || a.neighbourhood || a.suburb,
                a.suburb || a.city_district,
                a.city || a.town || a.village || a.county,
            ].filter(Boolean);

            const uniqueParts = [...new Set(parts)];

            const address =
                uniqueParts.join(", ") ||
                data.display_name?.split(",").slice(0, 3).join(",").trim() ||
                null;

            if (address) {
                cache.set(key, address);

                // Prevent unlimited memory growth
                if (cache.size > 1000) {
                    cache.delete(cache.keys().next().value);
                }
            }

            return address;
        } catch (error) {
            console.warn("Reverse geocoding failed:", error.message);
            return null;
        }
    });

    queue = task.catch(() => { });

    pending.set(key, task);

    try {
        return await task;
    } finally {
        pending.delete(key);
    }
};

module.exports = { reverseGeocode };
