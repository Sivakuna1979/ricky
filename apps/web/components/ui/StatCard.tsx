interface StatCardProps {
  label: string
  value: string
  icon: string
  color?: 'green' | 'blue' | 'orange' | 'brand' | 'red'
}

const colorMap = {
  green: 'bg-green-50 text-green-700',
  blue: 'bg-blue-50 text-blue-700',
  orange: 'bg-orange-50 text-orange-700',
  brand: 'bg-brand-50 text-brand-700',
  red: 'bg-red-50 text-red-700',
}

export function StatCard({ label, value, icon, color = 'brand' }: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg mb-3 ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-1">{label}</p>
    </div>
  )
}
