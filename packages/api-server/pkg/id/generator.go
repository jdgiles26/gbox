package id

import (
	"crypto/rand"
	"fmt"
)

// GenerateBoxID creates a UUID v4 box ID in the format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
func GenerateBoxID() string {
	// Generate 16 random bytes
	uuid := make([]byte, 16)
	_, err := rand.Read(uuid)
	if err != nil {
		// Fallback to a deterministic approach if crypto/rand fails
		panic(fmt.Sprintf("failed to generate random UUID: %v", err))
	}

	// Set version (4) and variant bits according to RFC 4122
	uuid[6] = (uuid[6] & 0x0f) | 0x40 // Version 4
	uuid[8] = (uuid[8] & 0x3f) | 0x80 // Variant is 10

	// Format as UUID string
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		uuid[0:4],
		uuid[4:6],
		uuid[6:8],
		uuid[8:10],
		uuid[10:16])
}
