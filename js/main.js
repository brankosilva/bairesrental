;(function () {
	
	'use strict';

	var isMobile = {
		Android: function() {
			return navigator.userAgent.match(/Android/i);
		},
			BlackBerry: function() {
			return navigator.userAgent.match(/BlackBerry/i);
		},
			iOS: function() {
			return navigator.userAgent.match(/iPhone|iPad|iPod/i);
		},
			Opera: function() {
			return navigator.userAgent.match(/Opera Mini/i);
		},
			Windows: function() {
			return navigator.userAgent.match(/IEMobile/i);
		},
			any: function() {
			return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
		}
	};

	var mobileMenuOutsideClick = function() {

		$(document).click(function (e) {
	    var container = $("#fh5co-offcanvas, .js-fh5co-nav-toggle");
	    if (!container.is(e.target) && container.has(e.target).length === 0) {

	    	if ( $('body').hasClass('offcanvas') ) {

    			$('body').removeClass('offcanvas');
    			$('.js-fh5co-nav-toggle').removeClass('active');
				
	    	}
	    
	    	
	    }
		});

	};


	var offcanvasMenu = function() {

		$('#page').prepend('<div id="fh5co-offcanvas" />');
		$('#page').prepend('<a href="#" class="js-fh5co-nav-toggle fh5co-nav-toggle fh5co-nav-white"><i></i></a>');
		var clone1 = $('.menu-1 > ul').clone();
		$('#fh5co-offcanvas').append(clone1);
		var clone2 = $('.menu-2 > ul').clone();
		$('#fh5co-offcanvas').append(clone2);

		$('#fh5co-offcanvas .has-dropdown').addClass('offcanvas-has-dropdown');
		$('#fh5co-offcanvas')
			.find('li')
			.removeClass('has-dropdown');

		// Hover dropdown menu on mobile
		$('.offcanvas-has-dropdown').mouseenter(function(){
			var $this = $(this);

			$this
				.addClass('active')
				.find('ul')
				.slideDown(500, 'easeOutExpo');				
		}).mouseleave(function(){

			var $this = $(this);
			$this
				.removeClass('active')
				.find('ul')
				.slideUp(500, 'easeOutExpo');				
		});


		$(window).resize(function(){

			if ( $('body').hasClass('offcanvas') ) {

    			$('body').removeClass('offcanvas');
    			$('.js-fh5co-nav-toggle').removeClass('active');
				
	    	}
		});
		
		    // Añadir efecto de scroll para cambiar la posición
			$(window).on('scroll', function() {
				var scrollTop = $(this).scrollTop(); // Obtiene la posición del scroll
				var $navToggle = $('.js-fh5co-nav-toggle'); // Selecciona el elemento dinámico
		
				if (scrollTop > 0) {
					$navToggle.addClass('scrolled'); // Agrega la clase
				} else {
					$navToggle.removeClass('scrolled'); // Elimina la clase
				}
			});
		};


	var burgerMenu = function() {

		$('body').on('click', '.js-fh5co-nav-toggle', function(event){
			var $this = $(this);


			if ( $('body').hasClass('overflow offcanvas') ) {
				$('body').removeClass('overflow offcanvas');
			} else {
				$('body').addClass('overflow offcanvas');
			}
			$this.toggleClass('active');
			event.preventDefault();

		});
	};



	var contentWayPoint = function() {
		var i = 0;
		$('.animate-box').waypoint( function( direction ) {

			if( direction === 'down' && !$(this.element).hasClass('animated-fast') ) {
				
				i++;

				$(this.element).addClass('item-animate');
				setTimeout(function(){

					$('body .animate-box.item-animate').each(function(k){
						var el = $(this);
						setTimeout( function () {
							var effect = el.data('animate-effect');
							if ( effect === 'fadeIn') {
								el.addClass('fadeIn animated-fast');
							} else if ( effect === 'fadeInLeft') {
								el.addClass('fadeInLeft animated-fast');
							} else if ( effect === 'fadeInRight') {
								el.addClass('fadeInRight animated-fast');
							} else {
								el.addClass('fadeInUp animated-fast');
							}

							el.removeClass('item-animate');
						},  k * 200, 'easeInOutExpo' );
					});
					
				}, 100);
				
			}

		} , { offset: '85%' } );
	};


	var dropdown = function() {

		$('.has-dropdown').mouseenter(function(){

			var $this = $(this);
			$this
				.find('.dropdown')
				.css('display', 'block')
				.addClass('animated-fast fadeInUpMenu');

		}).mouseleave(function(){
			var $this = $(this);

			$this
				.find('.dropdown')
				.css('display', 'none')
				.removeClass('animated-fast fadeInUpMenu');
		});

	};


	var goToTop = function() {

		$('.js-gotop').on('click', function(event){
			
			event.preventDefault();

			$('html, body').animate({
				scrollTop: $('html').offset().top
			}, 500, 'easeInOutExpo');
			
			return false;
		});

		$(window).scroll(function(){

			var $win = $(window);
			if ($win.scrollTop() > 200) {
				$('.js-top').addClass('active');
			} else {
				$('.js-top').removeClass('active');
			}

		});
	
	};


	// Loading page
	var loaderPage = function() {
		$(".fh5co-loader").fadeOut("slow");
	};

	var counter = function() {
		$('.js-counter').countTo({
			 formatter: function (value, options) {
	      return value.toFixed(options.decimals);
	    },
		});
	};

	var counterWayPoint = function() {
		if ($('#fh5co-counter').length > 0 ) {
			$('#fh5co-counter').waypoint( function( direction ) {
										
				if( direction === 'down' && !$(this.element).hasClass('animated') ) {
					setTimeout( counter , 400);					
					$(this.element).addClass('animated');
				}
			} , { offset: '90%' } );
		}
	};

	var sliderMain = function() {
		
	  	$('#fh5co-hero .flexslider').flexslider({
			animation: "slide",

			easing: "swing",
			direction: "vertical",

			slideshowSpeed: 5000,
			directionNav: true,
			start: function(){
				setTimeout(function(){
					$('.slider-text').removeClass('animated fadeInUp');
					$('.flex-active-slide').find('.slider-text').addClass('animated fadeInUp');
				}, 500);
			},
			before: function(){
				setTimeout(function(){
					$('.slider-text').removeClass('animated fadeInUp');
					$('.flex-active-slide').find('.slider-text').addClass('animated fadeInUp');
				}, 500);
			}

	  	});

	  	// $('#fh5co-hero .flexslider .slides > li').css('height', $(window).height());	
	  	// $(window).resize(function(){
	  	// 	$('#fh5co-hero .flexslider .slides > li').css('height', $(window).height());	
	  	// });

	};

	var parallax = function() {

		if ( !isMobile.any() ) {
			$(window).stellar({
				horizontalScrolling: false,
				hideDistantElements: false, 
				responsive: true

			});
		}
	};

	var testimonialCarousel = function(){
		
		var owl = $('.owl-carousel-fullwidth');
		owl.owlCarousel({
			items: 1,
			loop: true,
			margin: 0,
			nav: false,
			dots: true,
			smartSpeed: 800,
			autoHeight: true
		});

	};

	$(function(){
		mobileMenuOutsideClick();
		offcanvasMenu();
		burgerMenu();
		contentWayPoint();
		dropdown();
		goToTop();
		loaderPage();
		counterWayPoint();
		counter();
		parallax();
		sliderMain();
		testimonialCarousel();
	});

}());


/* scroll nav */

window.addEventListener("scroll", function(){
	var nav = document.querySelector ("nav");
	nav.classList.toggle("abajo",window.scrollY>0);
})


/* calculadora */


// script.js
const nightlyRate = 40; // Valor promedio por noche en USD

function updateNights(nights) {
  const nightsValue = document.getElementById('nightsValue');
  const earningsValue = document.getElementById('earningsValue');

  // Actualiza el valor de noches seleccionadas
  nightsValue.textContent = nights;

  // Calcula las ganancias
  const earnings = nights * nightlyRate;

  // Actualiza el valor de ganancias estimadas
  earningsValue.textContent = `U$D ${earnings}`;
}

/* formulario */

    function sendWhatsApp(event) {
        event.preventDefault();


        const name = document.getElementById("username")?.value || "No especificado";
        const email = document.getElementById("email")?.value || "No especificado";
        const comments = document.getElementById("coments")?.value || "No especificado";

        // Construir el mensaje para WhatsApp
        const message = `Hola, me contacto desde la web de *BairesRental*, les dejo mis datos y la consulta para que se comuniquen conmigo:\n\n` +
            `*Nombre y apellido:* ${name}\n` +
            `*Email:* ${email}\n` +
            `*Comentarios:* ${comments}\n\n` +
            `¡Espero su respuesta!`;

        const whatsappLink = `https://wa.me/5491165233257?text=${encodeURIComponent(message)}`;

        window.open(whatsappLink, '_blank'); 
 }
    document.querySelector(".registration-form-card").addEventListener("submit", sendWhatsApp);
	

/* carrusel deptos */

document.addEventListener("DOMContentLoaded", () => {
	// Seleccionamos todos los carruseles
	const carousels = document.querySelectorAll(".carousel");
  
	carousels.forEach((carousel) => {
	  const images = carousel.querySelectorAll(".carousel-image");
	  const prevButton = carousel.querySelector(".prev");
	  const nextButton = carousel.querySelector(".next");
	  let currentIndex = 0;
  
	  // Función para mostrar la imagen activa
	  const updateCarousel = () => {
		images.forEach((img, index) => {
		  img.classList.toggle("active", index === currentIndex);
		});
	  };
  
	  // Evento para el botón "prev"
	  prevButton.addEventListener("click", () => {
		currentIndex = (currentIndex - 1 + images.length) % images.length;
		updateCarousel();
	  });
  
	  // Evento para el botón "next"
	  nextButton.addEventListener("click", () => {
		currentIndex = (currentIndex + 1) % images.length;
		updateCarousel();
	  });
  
	  // Iniciar el carrusel mostrando la primera imagen
	  updateCarousel();
	});
  });
  