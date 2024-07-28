package types

import "fmt"

type APIError interface {
	error

	ErrorCode() int
	ErrorMessage() string
}

type InvalidRequestError struct {
	APIError
	Message      string
	ErrorCodeVal int
}

func (e *InvalidRequestError) Error() string {
	return fmt.Sprintf("Error code: %d, Message: %s", e.ErrorCodeVal, e.Message)
}

func (e *InvalidRequestError) ErrorCode() int {
	if e.ErrorCodeVal == 0 {
		return 400
	}
	return e.ErrorCodeVal
}

func (e *InvalidRequestError) ErrorMessage() string {
	if e.Message == "" {
		return "Invalid request"
	}
	return e.Message
}
