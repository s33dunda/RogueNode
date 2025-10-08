(define (problem rnd-001)
  (:domain rogue-devops-fd)
  (:objects
    s1 s2 s3 - server
    p1 - pod
    t1 - threat
    ssh scan - tool)
  (:init
    (accessible s1)
    (accessible s2)
    (accessible s3)
    (compromised s2))
  (:goal (and (secure-server s2)))
  (:metric minimize (total-cost))
)

