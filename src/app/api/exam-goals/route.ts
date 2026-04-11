import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/jwt'
import { ExamGoalService } from '@/services/examGoal.service'

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const goals = await ExamGoalService.getGoals(user.id)
    return NextResponse.json({ goals }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    if (!body?.subject_id || !body?.exam_date || !body?.target_hours) {
      return NextResponse.json({ error: 'Missing required fields: subject_id, exam_date, target_hours' }, { status: 400 })
    }
    const goal = await ExamGoalService.createGoal({
      user_id: user.id,
      subject_id: body.subject_id,
      exam_name: body.exam_name || '',
      exam_date: body.exam_date,
      target_hours: Number(body.target_hours),
    })
    return NextResponse.json({ goal }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await request.json()
    if (!body?.exam_goal_id) {
      return NextResponse.json({ error: 'Missing exam_goal_id' }, { status: 400 })
    }
    const goal = await ExamGoalService.updateGoal(body.exam_goal_id, user.id, {
      exam_name: body.exam_name,
      exam_date: body.exam_date,
      target_hours: body.target_hours ? Number(body.target_hours) : undefined,
    })
    return NextResponse.json({ goal }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const user = getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }
    await ExamGoalService.deleteGoal(id, user.id)
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400 })
  }
}
