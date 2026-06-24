package apperror

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Error struct {
	Code    string
	Message string
	Status  int
}

func (e *Error) Error() string {
	return e.Message
}

func New(code, message string, status int) *Error {
	return &Error{Code: code, Message: message, Status: status}
}

func Write(c *gin.Context, err *Error) {
	if err == nil {
		return
	}
	status := err.Status
	if status == 0 {
		status = http.StatusInternalServerError
	}
	body := gin.H{"error": err.Message}
	if err.Code != "" {
		body["code"] = err.Code
	}
	c.JSON(status, body)
}

func Abort(c *gin.Context, err *Error) {
	Write(c, err)
	c.Abort()
}

var (
	ErrUnauthorized = New("UNAUTHORIZED", "Niste prijavljeni", http.StatusUnauthorized)
	ErrForbidden    = New("FORBIDDEN", "Nedovoljne privilegije", http.StatusForbidden)
	ErrNotFound     = New("NOT_FOUND", "Nije pronađeno", http.StatusNotFound)
	ErrValidation   = New("VALIDATION", "Neispravan zahtev", http.StatusBadRequest)
	ErrRateLimited  = New("RATE_LIMITED", "Previše zahteva. Pokušajte ponovo za nekoliko trenutaka.", http.StatusTooManyRequests)
)
