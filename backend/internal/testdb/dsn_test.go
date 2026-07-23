package testdb

import (
	"strings"
	"testing"
)

func TestMemoryDSN_UniqueAcrossCalls(t *testing.T) {
	a := MemoryDSN(t, "iso")
	b := MemoryDSN(t, "iso")
	if a == b {
		t.Fatalf("expected unique DSN per call, got same %q", a)
	}
	if !strings.Contains(a, "mode=memory") || !strings.Contains(a, "cache=shared") {
		t.Fatalf("expected shared-memory DSN, got %q", a)
	}
	if !strings.HasPrefix(a, "file:iso_") || !strings.HasPrefix(b, "file:iso_") {
		t.Fatalf("expected package prefix, a=%q b=%q", a, b)
	}
}

func TestMemoryDSN_PrefixesIsolatePackages(t *testing.T) {
	a := MemoryDSN(t, "handlers")
	b := MemoryDSN(t, "guidebooking")
	if strings.Contains(a, "guidebooking_") || strings.Contains(b, "handlers_") {
		t.Fatalf("prefixes mixed: a=%q b=%q", a, b)
	}
}
