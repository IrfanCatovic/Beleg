package googleidtoken

import (
	"context"
	"errors"
	"testing"
	"time"

	"google.golang.org/api/idtoken"
)

func TestParseAudiences_CSVAndTrim(t *testing.T) {
	got := ParseAudiences(" web.apps.googleusercontent.com, android.apps.googleusercontent.com,web.apps.googleusercontent.com, , ios.apps.googleusercontent.com ")
	if len(got) != 3 {
		t.Fatalf("len=%d got=%v", len(got), got)
	}
	if got[0] != "web.apps.googleusercontent.com" || got[2] != "ios.apps.googleusercontent.com" {
		t.Fatalf("got=%v", got)
	}
}

func TestGoogleVerifier_NoAudiences(t *testing.T) {
	v := NewGoogleVerifier(nil)
	_, err := v.Verify(context.Background(), "token")
	if !errors.Is(err, ErrNoAudiencesConfigured) {
		t.Fatalf("err=%v", err)
	}
}

func TestGoogleVerifier_ValidPayload(t *testing.T) {
	v := &googleVerifier{
		audiences: []string{"web-client"},
		validate: func(_ context.Context, token, aud string) (*idtoken.Payload, error) {
			if token != "raw-id-token" || aud != "web-client" {
				t.Fatalf("token=%q aud=%q", token, aud)
			}
			return &idtoken.Payload{
				Issuer:   "https://accounts.google.com",
				Audience: "web-client",
				Subject:  "sub-1",
				Expires:  time.Now().Add(time.Hour).Unix(),
				Claims: map[string]any{
					"email":          "  Irfan@Example.COM ",
					"email_verified": true,
					"name":           "Irfan",
					"picture":        "https://example.com/a.png",
				},
			}, nil
		},
	}
	p, err := v.Verify(context.Background(), "raw-id-token")
	if err != nil {
		t.Fatal(err)
	}
	if p.Sub != "sub-1" || p.Email != "irfan@example.com" || !p.EmailVerified {
		t.Fatalf("payload=%+v", p)
	}
	if p.Aud != "web-client" || p.Name != "Irfan" {
		t.Fatalf("payload=%+v", p)
	}
}

func TestGoogleVerifier_WrongAudience(t *testing.T) {
	v := &googleVerifier{
		audiences: []string{"web-client"},
		validate: func(_ context.Context, _, _ string) (*idtoken.Payload, error) {
			return nil, errors.New("idtoken: audience provided does not match aud claim")
		},
	}
	_, err := v.Verify(context.Background(), "tok")
	if !errors.Is(err, ErrWrongAudience) {
		t.Fatalf("err=%v", err)
	}
}

func TestGoogleVerifier_Expired(t *testing.T) {
	v := &googleVerifier{
		audiences: []string{"web-client"},
		validate: func(_ context.Context, _, _ string) (*idtoken.Payload, error) {
			return nil, errors.New("idtoken: token expired")
		},
	}
	_, err := v.Verify(context.Background(), "tok")
	if !errors.Is(err, ErrExpired) {
		t.Fatalf("err=%v", err)
	}
}

func TestGoogleVerifier_ExpiredClaim(t *testing.T) {
	v := &googleVerifier{
		audiences: []string{"web-client"},
		validate: func(_ context.Context, _, _ string) (*idtoken.Payload, error) {
			return &idtoken.Payload{
				Issuer:   "https://accounts.google.com",
				Audience: "web-client",
				Subject:  "sub-1",
				Expires:  time.Now().Add(-time.Minute).Unix(),
				Claims:   map[string]any{"email": "a@b.com", "email_verified": true},
			}, nil
		},
	}
	_, err := v.Verify(context.Background(), "tok")
	if !errors.Is(err, ErrExpired) {
		t.Fatalf("err=%v", err)
	}
}

func TestGoogleVerifier_MissingSub(t *testing.T) {
	v := payloadVerifier(t, "", "a@b.com", true)
	_, err := v.Verify(context.Background(), "tok")
	if !errors.Is(err, ErrMissingSub) {
		t.Fatalf("err=%v", err)
	}
}

func TestGoogleVerifier_MissingEmail(t *testing.T) {
	v := payloadVerifier(t, "sub", "", true)
	_, err := v.Verify(context.Background(), "tok")
	if !errors.Is(err, ErrMissingEmail) {
		t.Fatalf("err=%v", err)
	}
}

func TestGoogleVerifier_EmailUnverified(t *testing.T) {
	v := payloadVerifier(t, "sub", "a@b.com", false)
	_, err := v.Verify(context.Background(), "tok")
	if !errors.Is(err, ErrEmailUnverified) {
		t.Fatalf("err=%v", err)
	}
}

func TestGoogleVerifier_InvalidIssuer(t *testing.T) {
	v := &googleVerifier{
		audiences: []string{"web-client"},
		validate: func(_ context.Context, _, _ string) (*idtoken.Payload, error) {
			return &idtoken.Payload{
				Issuer:   "https://evil.example",
				Audience: "web-client",
				Subject:  "sub",
				Expires:  time.Now().Add(time.Hour).Unix(),
				Claims:   map[string]any{"email": "a@b.com", "email_verified": true},
			}, nil
		},
	}
	_, err := v.Verify(context.Background(), "tok")
	if !errors.Is(err, ErrInvalidIssuer) {
		t.Fatalf("err=%v", err)
	}
}

func TestGoogleVerifier_InvalidSignature(t *testing.T) {
	v := &googleVerifier{
		audiences: []string{"web-client"},
		validate: func(_ context.Context, _, _ string) (*idtoken.Payload, error) {
			return nil, errors.New("idtoken: crypto/rsa: verification error")
		},
	}
	_, err := v.Verify(context.Background(), "tok")
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("err=%v", err)
	}
}

func payloadVerifier(t *testing.T, sub, email string, verified bool) Verifier {
	t.Helper()
	return &googleVerifier{
		audiences: []string{"web-client"},
		validate: func(_ context.Context, _, _ string) (*idtoken.Payload, error) {
			claims := map[string]any{"email_verified": verified}
			if email != "" {
				claims["email"] = email
			}
			return &idtoken.Payload{
				Issuer:   "accounts.google.com",
				Audience: "web-client",
				Subject:  sub,
				Expires:  time.Now().Add(time.Hour).Unix(),
				Claims:   claims,
			}, nil
		},
	}
}
