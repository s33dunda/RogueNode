;; Derived. Use `pnpm planning:refresh` to regenerate.
; domain
(define (domain rogue-devops-poc)
  (:requirements :strips :typing)
  (:types server)
  (:predicates
    (reachable ?s - server))
  (:action ping
    :parameters (?s - server) 
    :precondition ()
    :effect (and (reachable ?s))))
