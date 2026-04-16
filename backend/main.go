package main

import (
	"beleg-app/backend/internal/app"
	"beleg-app/backend/internal/routes"
)

func main() {
	app.Run(routes.RegisterLegacyRoutes)
}
