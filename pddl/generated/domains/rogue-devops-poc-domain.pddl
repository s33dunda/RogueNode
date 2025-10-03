;; Derived. Use `pnpm planning:refresh` to regenerate.
; domain
(define (domain rogue-node)
  (:requirements :strips :typing)
  (:types room item enemy server)
  (:predicates
    (at-room ?r - room)
    (room-exit ?from ?to - room ?dir - room)
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

  (:action move
    :parameters (?from ?to - room)
    :precondition (and
      (at-room ?from)
      (room-exit ?from ?to))
    :effect (and
      (not (at-room ?from))
      (at-room ?to)))

  (:action take
    :parameters (?i - item ?r - room)
    :precondition (and
      (at-room ?r)
      (item-at ?i ?r))
    :effect (and
      (not (item-at ?i ?r))
      (has-item ?i)))

  (:action use
    :parameters (?i - item ?e - enemy ?r - room)
    :precondition (and
      (at-room ?r)
      (enemy-at ?e ?r)
      (has-item ?i)
      (requires-item ?e ?i))
    :effect (and (enemy-defeated ?e))))
