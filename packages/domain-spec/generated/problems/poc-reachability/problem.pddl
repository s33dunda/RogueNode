;; Derived. Use `pnpm planning:refresh` to regenerate.
; problem
(define (problem poc-reachability)
  (:domain rogue-devops-poc)
  (:objects main-server - server)
  (:init)
  (:goal (and (reachable main-server))))
