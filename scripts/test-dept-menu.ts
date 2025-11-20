import { departmentService } from '../src/services/department.service'

async function run() {
  try {
    const res = await departmentService.getDepartmentMenu('restaurant')
    console.log(JSON.stringify(res, null, 2))
  } catch (err) {
    console.error(err)
  }
}

run()
