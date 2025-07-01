# Upskilling Plan Prototype

## 1. What does this code do?

This project is an interactive prototype for building and managing upskilling plans. It is fully front-end (HTML/CSS/JS) and runs in the browser.

**Functionalities added:**

1. Setting priorities for sections and subsections
2. Setting deadlines for sections and subsections
3. Nudging users to add tasks (encouragement message with quick-add button)
4. Creating subsections for better organization
5. Automatic reordering of sections and subsections according to deadline and then priorities
6. Integrated AI-recommended suggestions for tasks, with the option to create your own
7. Drag-and-drop reordering of sections, subsections, and cards
8. Edit/View mode toggle for safe editing (already there in the product - However this is important to access the functionalities)

---

## 2. How to run the code

1. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-org>/<repo>.git
   cd <repo>
   ```

2. **Start a local server:**
   - Using Python (no install needed):
     ```bash
     python3 -m http.server 8000
     ```
   - Or use any static server (VS Code Live Server, `npx serve`, etc).

3. **Open in your browser:**
   - Go to [http://localhost:8000](http://localhost:8000)

**No build step, no dependencies, no backend required.**
All code is in `index.html`, `style.css`, and `script.js`. 
