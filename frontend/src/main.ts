import './styles/index.css'
import { mountApp } from './App.ts'

const app = document.querySelector<HTMLDivElement>('#app')
if (app) {
  mountApp(app)
}
