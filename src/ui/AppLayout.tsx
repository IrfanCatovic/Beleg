import NavBar from "./NavBar";

export default function AppLayout() {
    return (
        <div>
            <header className="w-full border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-40">
                    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                    <NavBar />
                    </div>
            </header>
        </div>)
}