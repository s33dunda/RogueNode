;; Derived. Use `pnpm planning:refresh` to regenerate.
; problem
(define (problem rogue-node-ping-tutorial)
  (:domain rogue-node)
  (:objects server-room - room
            main-server - server)
  (:init
    (at-room server-room))
  (:goal (and (reachable main-server))))
