package guidebooking

import "errors"

var (
	ErrAlreadyFulfilled = errors.New("guide booking already fulfilled")
	ErrNotGuideTarget   = errors.New("not guide target")
	ErrInvalidAction    = errors.New("invalid action for booking")
	ErrActionNotOwned   = errors.New("action not owned by guide")
	ErrGuideOrganizer   = errors.New("za zahtev za vođenje akcija mora biti vodička (bez kluba)")
	ErrGuideMissing     = errors.New("vodička akcija mora imati dodeljenog vodiča")
	ErrActionNotFound   = errors.New("action not found")
)

// AcceptConflict nosi detalje kada je zahtev već rešen.
type AcceptConflict struct {
	FulfilledActionID    *uint
	FulfilledByGuideName string
}
