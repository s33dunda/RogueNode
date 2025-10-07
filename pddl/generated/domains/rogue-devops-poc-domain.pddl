;; Derived. Use `pnpm planning:refresh` to regenerate.
; domain
(define (domain rogue-node)
  (:requirements :strips :typing)
  (:types room item enemy server)
  (:predicates
    (at-room ?r - room)
    (item-at ?i - item ?r - room)
    (has-item ?i - item)
    (enemy-at ?e - enemy ?r - room)
    (enemy-defeated ?e - enemy)
    (requires-item ?e - enemy ?i - item)
    (reachable ?s - server))
  (:action ping
    :parameters (?s - server)
    :precondition ()
    :effect (and (reachable ?s)))
  (:action ssh
    :parameters (?s - server)
    :precondition (and (reachable ?s))
    :effect (and (reachable ?s)))
  (:action restart
    :parameters (?s - server)
    :precondition ()
    :effect (and (reachable ?s))))
