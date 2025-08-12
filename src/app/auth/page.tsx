import { AuthForm } from '@/components/auth-form'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AuthPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/documents')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50 px-4">
      <AuthForm />
    </div>
  )
}