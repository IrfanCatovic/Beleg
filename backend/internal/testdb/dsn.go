package testdb

import (
	"fmt"
	"strings"
	"sync/atomic"
	"testing"
)

// dsnSeq čini DSN jedinstvenim unutar procesa (uključujući go test -count=N).
var dsnSeq uint64

// MemoryDSN vraća process-unique shared-memory SQLite DSN.
//
// Zašto ne ":memory:": svaka pool konekcija dobija praznu bazu.
// Zašto ne samo file:<t.Name()>?cache=shared: isti naziv testa u različitim
// paketima (go test ./...) ili ponovljeni -count=N dijele bazu → UNIQUE/flake.
//
// packagePrefix (npr. "handlers", "guidebooking") sprečava cross-package sudare.
func MemoryDSN(t *testing.T, packagePrefix string) string {
	t.Helper()
	if packagePrefix == "" {
		packagePrefix = "pkg"
	}
	n := atomic.AddUint64(&dsnSeq, 1)
	name := strings.ReplaceAll(t.Name(), "/", "_")
	return fmt.Sprintf("file:%s_%s_%d?mode=memory&cache=shared", packagePrefix, name, n)
}
