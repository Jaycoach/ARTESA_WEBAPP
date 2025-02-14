import './App.css'
import Dashboard from './Components/Dashboard/Dashboard'
import Login from './Components/Login/Login'
import Register from './Components/Register/Register'

//Import React react dom
import {
  createBrowserRouter,
  RouterProvider
}   from 'react-router-dom'

//Create Router Functions
const router = createBrowserRouter([
{
  path: '/',
  element: <div><Login/></div>
},
{
  path: '/Register',
  element: <div><Register/></div>
},
{
  path: '/Dashboard',
  element: <div><Dashboard/></div>
}
])

function App() {
  return (
    <div>
      <RouterProvider router={router}/>
    </div>
  )
}

export default App
