import {createReviewHandler} from './handler.mjs'
import html from './viewer.html'
import css from './viewer.css'
import js from './viewer.js.txt'
import logo from '../../assets/brand/rv30-logo.png'
export default createReviewHandler({html,css,js,logo})
