import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function BackButton() {
  const navigate = useNavigate()
  const handleBack = () => {
    navigate(-1)
  }
  return (
    <button className="mb-4 flex items-center justify-center w-14 h-14 rounded-full bg-gray-100 text-gray-800 shadow-xl hover:bg-gray-200 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300" onClick={handleBack}
    >
      <ArrowLeftIcon className="h-7 w-7" />
    </button>
  )
}