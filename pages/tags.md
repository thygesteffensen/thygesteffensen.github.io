---
title: Tags
layout: default
permalink: /tags/
---

## Tags
<p>
{% for tag in site.tags %}
<a href="#{{tag[0] | slugify}}">{{tag[0]}}</a> 
{% endfor %}
<p>


{% for tag in site.tags %}

<h3 id="#{{tag[0] | slugify}}">{{tag[0]}}</h3> 
    <ul>
    {% for post in tag[1] %}
     <li><a href="{{post.url}}">{{post.title}}</a></li>
    {% endfor %}
    </ul>
{% endfor %}


