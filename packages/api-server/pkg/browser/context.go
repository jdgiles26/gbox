package model

// CdpURLResult represents the response from getting CDP URL.
type CdpURLResult struct {
	URL string `json:"url"`
}

// NewCdpURLResult creates a new CdpURLResult.
func NewCdpURLResult(url string) CdpURLResult {
	return CdpURLResult{
		URL: url,
	}
}
