# 30 Frontend State Ownership

## Explicit State Hierarchy

- **Routing & Navigation:** Next.js App Router owns page routing and segment state.
- **Remote / Server State:** TanStack Query owns remote state in client components. Do not fetch with custom useEffect calls.
- **Form State:** TanStack Form owns form state, inputs, and validation feedback.
- **Schema Validation:** Zod owns shared input validation schemas between client forms and server endpoints.
- **Complex Table State:** TanStack Table owns sorting, filtering, and pagination state in tabular views.
- **URL Parameters:** URL search params (`?search=`, `?page=`, `?status=`) own shareable filters, sorting, and view options.
- **Local Component State:** React `useState` / `useReducer` owns small transient UI state (e.g. modal open state).
- **Authentication State:** Better Auth owns session and authentication status.
- **Persistent Data:** PostgreSQL database owns persistent business data.

Prohibited state libraries: Redux, Zustand, MobX, React Hook Form, Formik, Axios, SWR, React Router, TanStack Router.
