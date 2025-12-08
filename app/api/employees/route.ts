import { NextResponse } from 'next/server'

/**
 * GET /api/employees
 * List employees
 * Placeholder endpoint - employees logic integrated into /api/users
 */
export async function GET(req: Request) {
  // Employees are now managed via /api/users with userType=employee filter
  const newUrl = new URL(req.url)
  newUrl.pathname = '/api/users'
  newUrl.searchParams.set('userType', 'employee')
  
  try {
    const res = await fetch(newUrl.toString(), {
      method: 'GET',
      headers: req.headers,
      credentials: 'include',
    })
    return res
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  // Employees created via /api/users with userType=employee
  const newUrl = new URL(req.url)
  newUrl.pathname = '/api/users'
  
  try {
    const body = await req.json()
    const res = await fetch(newUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...req.headers },
      body: JSON.stringify({ ...body, userType: 'employee' }),
      credentials: 'include',
    })
    return res
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
