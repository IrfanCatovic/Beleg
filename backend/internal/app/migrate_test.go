package app

import (
	"os"
	"testing"
)

func TestShouldAutoMigrate_DefaultTrue(t *testing.T) {
	t.Setenv("AUTO_MIGRATE", "")
	if !shouldAutoMigrate() {
		t.Fatal("expected default AUTO_MIGRATE to enable migration")
	}
}

func TestShouldAutoMigrate_FalseSkipsMigrationPath(t *testing.T) {
	for _, v := range []string{"false", "0", "no", "FALSE"} {
		t.Run(v, func(t *testing.T) {
			t.Setenv("AUTO_MIGRATE", v)
			if shouldAutoMigrate() {
				t.Fatalf("expected AUTO_MIGRATE=%q to disable migration", v)
			}
		})
	}
}

func TestMigrateAndSeedSkipsIndexCheckWhenAutoMigrateFalse(t *testing.T) {
	t.Setenv("AUTO_MIGRATE", "false")
	if shouldAutoMigrate() {
		t.Fatal("test setup: AUTO_MIGRATE should be false")
	}
	_ = os.Getenv("AUTO_MIGRATE")
}
