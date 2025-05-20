package id_test

import (
	"regexp"
	"testing"

	"github.com/babelcloud/gbox/packages/api-server/pkg/id"
	"github.com/stretchr/testify/assert"
)

func TestGenerateBoxID(t *testing.T) {
	// Test multiple IDs to ensure format and uniqueness
	generatedIDs := make(map[string]bool)
	iterations := 1000

	for i := 0; i < iterations; i++ {
		boxID := id.GenerateBoxID()

		// Check format matches word-word-XXXX where XXXX is 4 digits
		pattern := `^[a-z]+-[a-z]+-\d{4}$`
		matched, err := regexp.MatchString(pattern, boxID)
		assert.NoError(t, err)
		assert.True(t, matched, "Generated ID %s does not match expected pattern", boxID)

		// Check uniqueness
		_, exists := generatedIDs[boxID]
		assert.False(t, exists, "Generated duplicate ID: %s", boxID)
		generatedIDs[boxID] = true

		// Check length constraints
		parts := regexp.MustCompile(`-`).Split(boxID, -1)
		assert.Equal(t, 3, len(parts), "Generated ID should have 3 parts")

		// Check numeric part is 4 digits
		assert.Equal(t, 4, len(parts[2]), "Numeric part should be 4 digits")

		// Check numeric part is between 1000-9999
		numPattern := `^[1-9]\d{3}$`
		matched, err = regexp.MatchString(numPattern, parts[2])
		assert.NoError(t, err)
		assert.True(t, matched, "Numeric part %s is not between 1000-9999", parts[2])
	}
}
