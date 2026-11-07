import {createReviewHandler} from './handler.mjs'
import html from './viewer.html'
import css from './viewer.css'
import js from './viewer.js.txt'
import logo from '../../assets/brand/rv30-logo.png'
import qaHtml from './qa-account.html'
import qaJs from './qa-account.js.txt'
export default createReviewHandler({html,css,js,logo,qaHtml,qaJs})
